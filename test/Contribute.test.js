const { HATCH_STATE, HATCH_PERIOD, HATCH_MAX_GOAL, ZERO_ADDRESS } = require('./helpers/constants')
const { sendTransaction, contributionToProjectTokens, getEvent, now } = require('./common/utils')
const { prepareDefaultSetup, defaultDeployParams, initializeHatch, deployDefaultSetup } = require('./common/deploy')
const { assertRevert, assertBn } = require('@1hive/contract-helpers-test/src/asserts')
const { bn } = require('@1hive/contract-helpers-test/src/numbers')

contract('Hatch, contribute() functionality', ([anyone, appManager, contributor1, contributor2]) => {
  const initializeHatchWithERC20 = async startDate => {
    await this.contributionToken.generateTokens(contributor1, bn('100e18'))
    await this.contributionToken.generateTokens(contributor2, bn('100000e18'))
    await this.contributionToken.approve(this.hatch.address, bn('100e18'), { from: contributor1 })
    await this.contributionToken.approve(this.hatch.address, bn('100000e18'), { from: contributor2 })

    await initializeHatch(this, { ...defaultDeployParams(this, appManager), startDate })
  }

  const initializeHatchWithETH = async startDate => {
    this.contributionToken = {
      balanceOf: async address => new Promise(resolve => resolve(web3.eth.getBalance(address))),
    }

    await initializeHatch(this, { ...defaultDeployParams(this, appManager), startDate, contributionToken: ZERO_ADDRESS })
  }

  const contribute = (sender, amount, useETH) => {
    return this.hatch.contribute(amount, { from: sender, value: useETH ? amount : 0 })
  }

  const itAllowsUsersToContribute = (useETH, startDate) => {
    before('Prepare app', async () => {
      await prepareDefaultSetup(this, appManager)
    })

    before('Initialize token and app', async () => {
      if (useETH) {
        await initializeHatchWithETH(startDate)
      } else {
        await initializeHatchWithERC20(startDate)
      }
    })

    it('Reverts if the user attempts to buy tokens before the hatch has started', async () => {
      await assertRevert(contribute(contributor1, 1, useETH), 'HATCH_INVALID_STATE')
    })

    describe('When the hatch has started', () => {
      const contributionAmount = bn('100e18')
      const acceptableGasDiff = bn(web3.utils.toWei('0.01', 'ether'))

      before('Open the hatch if necessary, and set the date to the open date', async () => {
        if (startDate == 0) {
          startDate = now()
          await this.hatch.open({ from: appManager })
        }
        this.hatch.mockSetTimestamp(startDate + 1)
      })

      it('App state should be Funding', async () => {
        assert.equal((await this.hatch.state()).toNumber(), HATCH_STATE.FUNDING)
      })

      it('A user can query how many project tokens would be obtained for a given amount of contribution tokens', async () => {
        const reportedAmount = await this.hatch.contributionToTokens(contributionAmount)
        const expectedAmount = contributionToProjectTokens(contributionAmount)
        assertBn(reportedAmount, expectedAmount)
      })

      describe('When a user buys project tokens', () => {
        let contributionTx
        let contributor1_initialBalance

        before('Record initial token balances and make a contribution', async () => {
          contributor1_initialBalance = bn(await this.contributionToken.balanceOf(contributor1))

          contributionTx = await contribute(contributor1, contributionAmount, useETH)
        })

        it('Mints the correct amount of project tokens', async () => {
          const totalSupply = await this.projectToken.totalSupply()
          const expectedAmount = contributionToProjectTokens(contributionAmount)
          assertBn(totalSupply, expectedAmount)
        })

        it('Reduces user contribution token balance', async () => {
          const userBalance = bn(await this.contributionToken.balanceOf(contributor1))
          const expectedBalance = contributor1_initialBalance.sub(contributionAmount)
          assert.isTrue(userBalance.lt(expectedBalance.add(acceptableGasDiff)))
        })

        it('Increases hatch contribution token balance', async () => {
          const appBalance = await this.contributionToken.balanceOf(this.hatch.address)
          assertBn(appBalance, contributionAmount)
        })

        it('Tokens are minted to the contributor', async () => {
          const userBalance = await this.projectToken.balanceOf(contributor1)
          const expectedAmount = contributionToProjectTokens(contributionAmount)
          assertBn(userBalance, expectedAmount)
        })

        it('A Contribute event is emitted', async () => {
          const expectedAmount = contributionToProjectTokens(contributionAmount)
          const event = getEvent(contributionTx, 'Contribute')
          assert.isTrue(!!event)
          assert.equal(event.args.contributor, contributor1)
          assertBn(bn(event.args.value), contributionAmount)
          assertBn(bn(event.args.amount), expectedAmount)
        })

        it('A contributor can contribute many times', async () => {
          await contribute(contributor2, 1, useETH)
          await contribute(contributor2, 2, useETH)
          await contribute(contributor2, 3, useETH)
        })

        it('Keeps track of total tokens raised', async () => {
          const raised = await this.hatch.totalRaised()
          assertBn(raised, contributionAmount.add(bn(6)))
        })

        it('Keeps track of independent contributors', async () => {
          assertBn(await this.hatch.contributions(contributor1), contributionAmount)
          assert.equal((await this.hatch.contributions(contributor2)).toNumber(), 6)
        })

        if (!useETH) {
          it("Reverts when sending ETH in a contribution that's supposed to use ERC20 tokens", async () => {
            await assertRevert(contribute(contributor1, bn('10e18'), true), 'HATCH_INVALID_CONTRIBUTE_VALUE')
          })
        } else {
          it('Reverts if the ETH amount sent does not match the specified amount', async () => {
            const amount = 2
            await assertRevert(this.hatch.contribute(amount, { value: amount - 1 }), 'HATCH_INVALID_CONTRIBUTE_VALUE')
            await assertRevert(this.hatch.contribute(amount, { value: amount + 1 }), 'HATCH_INVALID_CONTRIBUTE_VALUE')
          })
        }

        describe('When the hatch is Refunding', () => {
          before(async () => {
            this.hatch.mockSetTimestamp(startDate + HATCH_PERIOD + 1)
          })

          it('Hatch state is Refunding', async () => {
            assert.equal((await this.hatch.state()).toNumber(), HATCH_STATE.REFUNDING)
          })

          it('Reverts if a user attempts to buy tokens', async () => {
            await assertRevert(contribute(contributor2, 1, useETH), 'HATCH_INVALID_STATE')
          })
        })

        describe('When the hatch state is GoalReached', () => {
          before(async () => {
            this.hatch.mockSetTimestamp(startDate + HATCH_PERIOD / 2)
          })

          it('A contribution cannot cause totalRaised to be greater than the hatchMaxGoal', async () => {
            const raised = bn(await this.hatch.totalRaised())
            const remainingToFundingGoal = HATCH_MAX_GOAL.sub(raised)
            const userBalanceBeforeContribution = bn(await this.contributionToken.balanceOf(contributor2))

            const amount = HATCH_MAX_GOAL * 2
            await contribute(contributor2, amount, useETH)
            const userBalanceAfterContribution = bn(await this.contributionToken.balanceOf(contributor2))

            const tokensUsedInContribution = userBalanceBeforeContribution.sub(userBalanceAfterContribution)

            assert.isTrue(tokensUsedInContribution.lt(remainingToFundingGoal.add(acceptableGasDiff)))
          })

          it('Hatch state is GoalReached', async () => {
            assert.equal((await this.hatch.state()).toNumber(), HATCH_STATE.GOAL_REACHED)
          })

          it('Reverts if a user attempts to buy tokens', async () => {
            await assertRevert(contribute(contributor2, 1, useETH), 'HATCH_INVALID_STATE')
          })
        })
      })
    })
  }

  describe('When sending ETH directly to the Hatch contract', () => {
    before(async () => {
      await deployDefaultSetup(this, appManager)
    })

    it('Reverts [@skip-on-coverage]', async () => {
      await assertRevert(sendTransaction({ from: anyone, to: this.hatch.address, value: web3.utils.toWei('1', 'ether') }))
    })
  })

  describe('When using ERC20 tokens as contribution tokens', () => {
    describe('When no startDate is specified upon initialization', () => {
      itAllowsUsersToContribute(false, 0)
    })

    describe('When a startDate is specified upon initialization', () => {
      itAllowsUsersToContribute(false, now() + 3600)
    })
  })

  describe('When using ETH as contribution tokens', () => {
    describe('When no startDate is specified upon initialization', () => {
      itAllowsUsersToContribute(true, 0)
    })

    describe('When a startDate is specified upon initialization', () => {
      itAllowsUsersToContribute(true, now() + 3600)
    })
  })
})
