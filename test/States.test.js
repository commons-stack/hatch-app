const { HATCH_PERIOD, HATCH_MAX_GOAL, HATCH_STATE, HATCH_MIN_GOAL, ZERO_ADDRESS } = require('./helpers/constants')
const { prepareDefaultSetup, defaultDeployParams, initializeHatch } = require('./common/deploy')
const { now } = require('./common/utils')

const getState = async test => {
  return (await test.hatch.state()).toNumber()
}

contract('Hatch, states validation', ([anyone, appManager, buyer]) => {
  const itManagesStateCorrectly = startDate => {
    describe('When a hatch is deployed', () => {
      before(async () => {
        await prepareDefaultSetup(this, appManager)
        await initializeHatch(this, { ...defaultDeployParams(this, appManager), startDate })

        await this.contributionToken.generateTokens(buyer, HATCH_MAX_GOAL)
        await this.contributionToken.approve(this.hatch.address, HATCH_MAX_GOAL, { from: buyer })
      })

      it('Initial state is Pending', async () => {
        assert.equal(await getState(this), HATCH_STATE.PENDING)
      })

      it('ACL oracle canPerform() returns false', async () => {
        assert.isFalse(await this.hatch.canPerform(ZERO_ADDRESS, ZERO_ADDRESS, '0x', []))
      })

      describe('When the hatch is started', () => {
        before(async () => {
          if (startDate == 0) {
            startDate = now()
            await this.hatch.open({ from: appManager })
          }
          this.hatch.mockSetTimestamp(startDate + 1)
        })

        it('The state is Funding', async () => {
          assert.equal(await getState(this), HATCH_STATE.FUNDING)
        })

        it('Contribution token recoverability is not possible', async () => {
          assert.isTrue(await this.hatch.allowRecoverability(ZERO_ADDRESS));
          assert.isFalse(await this.hatch.allowRecoverability(this.contributionToken.address));
        });

        it('ACL oracle canPerform() returns false', async () => {
          assert.isFalse(await this.hatch.canPerform(ZERO_ADDRESS, ZERO_ADDRESS, '0x', []))
        })

        describe('When the funding period is still running', () => {
          before(async () => {
            this.hatch.mockSetTimestamp(startDate + HATCH_PERIOD / 2)
          })

          it('The state is still Funding', async () => {
            assert.equal(await getState(this), HATCH_STATE.FUNDING)
          })

          describe('When contributions are made, not reaching the min funding goal', () => {
            before(async () => {
              await this.hatch.contribute(HATCH_MIN_GOAL / 2, { from: buyer })
            })

            it('The state is still Funding', async () => {
              assert.equal(await getState(this), HATCH_STATE.FUNDING)
            })

            describe('When the funding period elapses without having reached the funding goal', () => {
              before(async () => {
                this.hatch.mockSetTimestamp(startDate + HATCH_PERIOD + 1)
              })

              it('The state is Refunding', async () => {
                assert.equal(await getState(this), HATCH_STATE.REFUNDING)
              })

              it('ACL oracle canPerform() returns true', async () => {
                assert.isTrue(await this.hatch.canPerform(ZERO_ADDRESS, ZERO_ADDRESS, '0x', []))
              })
            })
          })

          describe('When contributions are made, reaching the min funding goal before the funding period elapsed', () => {
            before(async () => {
              this.hatch.mockSetTimestamp(startDate + HATCH_PERIOD / 2)
              await this.hatch.contribute(HATCH_MIN_GOAL / 2, { from: buyer })
            })

            it('The state is Funding', async () => {
              assert.equal(await getState(this), HATCH_STATE.FUNDING)
            })

            describe('When the funding period elapses having reached the min funding goal', () => {
              before(async () => {
                this.hatch.mockSetTimestamp(startDate + HATCH_PERIOD + 1)
              })

              it('The state is GoalReached', async () => {
                assert.equal(await getState(this), HATCH_STATE.GOAL_REACHED)
              })
            })

            describe('When within the funding period and having reached the max funding goal', () => {
              before(async () => {
                this.hatch.mockSetTimestamp(startDate + HATCH_PERIOD / 2)
                await this.hatch.contribute(HATCH_MAX_GOAL, { from: buyer })
              })

              it('The state is GoalReached', async () => {
                assert.equal(await getState(this), HATCH_STATE.GOAL_REACHED)
              })
            })

            describe('When the funding period elapses having reached the max funding goal', () => {
              before(async () => {
                this.hatch.mockSetTimestamp(startDate + HATCH_PERIOD + 1)
              })
  
              it('The state is still GoalReached', async () => {
                assert.equal(await getState(this), HATCH_STATE.GOAL_REACHED)
              })
            })

            describe('When the hatch is closed', () => {
              before(async () => {
                await this.hatch.close()
              })

              it('The state is Closed', async () => {
                assert.equal(await getState(this), HATCH_STATE.CLOSED)
              })

              it('ACL oracle canPerform() returns true', async () => {
                assert.isTrue(await this.hatch.canPerform(ZERO_ADDRESS, ZERO_ADDRESS, '0x', []))
              })

              it('Contribution token recoverability is possible', async () => {
                assert.isTrue(await this.hatch.allowRecoverability(ZERO_ADDRESS));
                assert.isTrue(await this.hatch.allowRecoverability(this.contributionToken.address));
              });
            })
          })
        })
      })
    })
  }

  describe('When no startDate is specified upon initialization', () => {
    itManagesStateCorrectly(0)
  })

  describe('When a startDate is specified upon initialization', () => {
    itManagesStateCorrectly(now() + 3600)
  })
})
