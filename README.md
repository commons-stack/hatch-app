Hatch
=====

The Hatch application allows organizations to set a minimum fundraising target that must be reached during a given period of time.

#### 🐲 Project Stage: Production

The Hatch app is published to `marketplace-hatch.open.aragonpm.eth` on xDAI and Rinkeby networks. If you experience any issues or are interested in contributing please see review our [open issues](https://github.com/CommonsSwarm/hatch-app).

#### 🚨 Security Review Status: pre-audit

The code in this repository has not been audited.

## Initialization

The Hatch app is initialized with the following parameters:

* `TokenManager _tokenManager` is the address of the bonded token manager contract.
* `address _reserve` the address of the reserve pool contract.
* `address _beneficiary` is the address of the beneficiary to whom a percentage of the raised funds is be to be sent.
* `address _contributionToken` is the address of the token to be used to contribute.
* `uint256 _minGoal` is the min goal to be reached by the end of that hatch (in contribution token wei).
* `uint256 _maxGoal` is the goal that closes the hatch  when it is reached even if the hatch period has not ended (in contribution token wei).
* `uint64 _period` is the period within which to accept contribution for that hatch.
* `uint256 _exchangeRate` is the exchange rate at which bonded tokens are to be purchased for that hatch (in PPM).
* `uint256 _supplyOfferedPct` is the percentage of the initial supply of bonded tokens to be offered during that hatch (in PPM).
* `uint256 _fundingForBeneficiaryPct` is the percentage of the raised contribution tokens to be sent to the beneficiary (instead of the fundraising reserve) when that hatch is closed (in PPM).
* `uint64 _openDate` is the date upon which the hatch is to be open (ignored if 0).

## Roles

The Hatch app implements the following roles:

* **OPEN_ROLE**: Determines who can open the hatch.
* **CONTRIBUTE_ROLE**: Determines who can contribute to the hatch.

The Hatch app should have the following roles:

* **MINT_ROLE**, **BURN_ROLE**: It should be able to mint and burn hatch tokens in Token Manager.

## Interface

The Hatch app doesn't implement a specific front end. It uses the following [interface](https://github.com/CommonsSwarm/tec-hatch) together with the rest of the apps that make up the [Hatch template](https://github.com/CommonsSwarm/hatch-template).

## How to run Hatch locally

The Hatch app works in tandem with other Aragon applications. While we do not explore this functionality as a stand alone demo, the [Hatch template](https://github.com/CommonsSwarm/hatch-template) uses the Hatch and it can be run locally.



## Deploying to an Aragon DAO

Currently, the Hatch app repo has been deployed to rinkeby and xdai. You can use one of the following methods to install the app.

### Using the Aragon CLI

```
dao install <dao-address> marketplace-hatch.open.aragonpm.eth --env aragon:<network>
```

`network`: Network name to connect with.

Note you can only install apps on Rinkeby DAOs as the aragon CLI doesn't support xDai.

We recommend using [Frame](https://frame.sh/) to execute the command by adding the `--use-frame` flag at the end.

### Using the Aragon client in-app console

You can install the Hatch app by using the following console command:

```
install/marketplace-hatch/(...initParams)/OPEN_ROLE:<manager-address>:<grantee-address>,CONTRIBUTE_ROLE:<manager-address>:<grantee-address>
```

The `initParams` are set by separating them with a comma.

You can read more about the in-app console [here](https://github.com/aragon/client/blob/master/docs/CONSOLE.md).


## Disclaimer
Hatch is an open source app. None of the people or institutions involved in its development may be held accountable for how it is used. If you do use it please make sure you comply to the jurisdictions you may be jubjected to.