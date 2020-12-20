const getContract = name => artifacts.require(name)
const { hash: nameHash } = require('eth-ens-namehash')

const DAOFactory = artifacts.require('@aragon/core/contracts/factory/DAOFactory')
const EVMScriptRegistryFactory = artifacts.require('@aragon/core/contracts/factory/EVMScriptRegistryFactory')
const ACL = artifacts.require('@aragon/core/contracts/acl/ACL')
const Kernel = artifacts.require('@aragon/core/contracts/kernel/Kernel')
const MiniMeToken = artifacts.require('@aragon/minime/contracts/MiniMeToken')

const TokenManager = artifacts.require('TokenManager.sol')
const Vault = artifacts.require('Vault.sol')
const Hatch = artifacts.require('HatchMock.sol')
const { newDao, installNewApp } = require('@aragon/contract-helpers-test/src/aragon-os')


const {
  ANY_ADDRESS,
  ZERO_ADDRESS,
  HATCH_MAX_GOAL,
  HATCH_MIN_GOAL,
  HATCH_PERIOD,
  HATCH_EXCHANGE_RATE,
  VESTING_CLIFF_PERIOD,
  VESTING_COMPLETE_PERIOD,
  PERCENT_SUPPLY_OFFERED,
  PERCENT_FUNDING_FOR_BENEFICIARY,
} = require('../helpers/constants')

const { now } = require('./utils')

const deploy = {

  /* DAO */
  deployDAO: async (test, daoManager) => {
    const { dao, acl } = await newDao(daoManager)
    test.dao = dao
    test.acl = acl
    test.APP_MANAGER_ROLE = await dao.APP_MANAGER_ROLE()
  },

  /* RESERVE */
  deployReserve: async (test, appManager) => {
    const appBase = await Vault.new()
    test.reserve = await Vault.at(await installNewApp(
      test.dao,
      nameHash('pool.aragonpm.test'),
      appBase.address,
      appManager
    ))
    test.RESERVE_TRANSFER_ROLE = await appBase.TRANSFER_ROLE()
    // test.RESERVE_ADD_PROTECTED_TOKEN_ROLE = await appBase.ADD_PROTECTED_TOKEN_ROLE()
  },
  setReservePermissions: async (test, appManager) => {
    await test.acl.createPermission(ANY_ADDRESS, test.reserve.address, test.RESERVE_TRANSFER_ROLE, appManager, { from: appManager })
    // await test.acl.createPermission(ANY_ADDRESS, test.reserve.address, test.RESERVE_ADD_PROTECTED_TOKEN_ROLE, appManager, { from: appManager })
  },
  initializeReserve: async test => {
    await test.reserve.initialize()
  },

  /* VAULT */
  deployVault: async (test, appManager) => {
    const appBase = await Vault.new()
    test.vault = await Vault.at(await installNewApp(
      test.dao,
      nameHash('vault.aragonpm.eth'),
      appBase.address,
      appManager
    ))
  },
  setVaultPermissions: async (test, appManager) => {
    // No permissions
  },
  initializeVault: async test => {
    await test.vault.initialize()
  },

  /* TOKEN MANAGER */
  deployTokenManager: async (test, appManager) => {
    const appBase = await TokenManager.new()
    test.tokenManager = await TokenManager.at(await installNewApp(
      test.dao,
      nameHash('token-manager.aragonpm.eth'),
      appBase.address,
      appManager
    ))
    test.TOKEN_MANAGER_MINT_ROLE = await appBase.MINT_ROLE()
    test.TOKEN_MANAGER_ISSUE_ROLE = await appBase.ISSUE_ROLE()
    test.TOKEN_MANAGER_ASSIGN_ROLE = await appBase.ASSIGN_ROLE()
    test.TOKEN_MANAGER_REVOKE_VESTINGS_ROLE = await appBase.REVOKE_VESTINGS_ROLE()
    test.TOKEN_MANAGER_BURN_ROLE = await appBase.BURN_ROLE()
  },
  setTokenManagerPermissions: async (test, appManager) => {
    await test.acl.createPermission(ANY_ADDRESS, test.tokenManager.address, test.TOKEN_MANAGER_MINT_ROLE, appManager, { from: appManager })
    await test.acl.createPermission(ANY_ADDRESS, test.tokenManager.address, test.TOKEN_MANAGER_BURN_ROLE, appManager, { from: appManager })
    await test.acl.createPermission(ANY_ADDRESS, test.tokenManager.address, test.TOKEN_MANAGER_REVOKE_VESTINGS_ROLE, appManager, { from: appManager })
    await test.acl.createPermission(ANY_ADDRESS, test.tokenManager.address, test.TOKEN_MANAGER_ISSUE_ROLE, appManager, { from: appManager })
    await test.acl.createPermission(ANY_ADDRESS, test.tokenManager.address, test.TOKEN_MANAGER_ASSIGN_ROLE, appManager, { from: appManager })
  },
  initializeTokenManager: async test => {
    await test.projectToken.changeController(test.tokenManager.address)
    await test.tokenManager.initialize(test.projectToken.address, true /* transferable */, 0 /* macAccountTokens (infinite if set to 0) */)
  },

  /* HATCH */
  deployHatch: async (test, appManager) => {
    const appBase = await Hatch.new()
    test.hatch = await Hatch.at(await installNewApp(
      test.dao,
      nameHash('hatch.aragonpm.eth'),
      appBase.address,
      appManager
    ))
    test.HATCH_OPEN_ROLE = await appBase.OPEN_ROLE()
    test.HATCH_CONTRIBUTE_ROLE = await appBase.CONTRIBUTE_ROLE()
    test.HATCH_CLOSE_ROLE = await appBase.CLOSE_ROLE()
  },
  setHatchPermissions: async (test, appManager) => {
    await test.acl.createPermission(appManager, test.hatch.address, test.HATCH_OPEN_ROLE, appManager, { from: appManager })
    await test.acl.createPermission(ANY_ADDRESS, test.hatch.address, test.HATCH_CONTRIBUTE_ROLE, appManager, { from: appManager })
    await test.acl.createPermission(ANY_ADDRESS, test.hatch.address, test.HATCH_CLOSE_ROLE, appManager, { from: appManager })
  },
  initializeHatch: async (test, params) => {
    const paramsArr = [
      params.tokenManager,
      params.reserve,
      params.beneficiary,
      params.contributionToken,
      params.hatchMaxGoal,
      params.hatchMinGoal,
      params.hatchPeriod,
      params.hatchExchangeRate,
      params.vestingCliffPeriod,
      params.vestingCompletePeriod,
      params.percentSupplyOffered,
      params.percentFundingForBeneficiary,
      params.startDate,
    ]
    test.hatch.mockSetTimestamp(now())
    return test.hatch.initialize(...paramsArr)
  },
  defaultDeployParams: (test, beneficiary) => {
    return {
      contributionToken: test.contributionToken.address,
      tokenManager: test.tokenManager.address,
      vestingCliffPeriod: VESTING_CLIFF_PERIOD,
      vestingCompletePeriod: VESTING_COMPLETE_PERIOD,
      hatchMaxGoal: HATCH_MAX_GOAL,
      hatchMinGoal: HATCH_MIN_GOAL,
      hatchExchangeRate: HATCH_EXCHANGE_RATE,
      percentSupplyOffered: PERCENT_SUPPLY_OFFERED,
      hatchPeriod: HATCH_PERIOD,
      reserve: test.reserve.address,
      beneficiary,
      percentFundingForBeneficiary: PERCENT_FUNDING_FOR_BENEFICIARY,
      startDate: 0,
      collaterals: [test.contributionToken.address, test.ant.address],
    }
  },

  /* TOKENS */
  deployTokens: async test => {
    test.contributionToken = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'DaiToken', 18, 'DAI', true)
    test.projectToken = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'ProjectToken', 18, 'PRO', true)
    test.ant = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'AntToken', 18, 'ANT', true)
  },

  /* ~EVERYTHING~ */
  prepareDefaultSetup: async (test, appManager) => {
    await deploy.deployDAO(test, appManager)

    await deploy.deployTokens(test)
    await deploy.deployTokenManager(test, appManager)

    await deploy.deployVault(test, appManager)
    await deploy.deployReserve(test, appManager)
    await deploy.deployHatch(test, appManager)

    await deploy.setVaultPermissions(test, appManager)
    await deploy.setReservePermissions(test, appManager)
    await deploy.setHatchPermissions(test, appManager)
    await deploy.setTokenManagerPermissions(test, appManager)

    await deploy.initializeVault(test)
    await deploy.initializeReserve(test)
    await deploy.initializeTokenManager(test)
  },
  deployDefaultSetup: async (test, appManager) => {
    await deploy.prepareDefaultSetup(test, appManager)
    return await deploy.initializeHatch(test, deploy.defaultDeployParams(test, appManager))
  },
}

module.exports = deploy
