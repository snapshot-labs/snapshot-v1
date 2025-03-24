# Galxe Plugin

Created time: July 21, 2022 5:51 PM

The **Galxe Plugin is designed for Snapshot.org. This will incentivize communities to participate in the proposal vote by rewarding them with OATs (On-Chain Achievement Tokens). Space Admin can add this plugin into your space. After users vote, they can claim an OAT directly from the Galxe Plugin section on the proposal page.**

### 1. Preparation

1. Create a Snapshot proposal on [https://snapshot.org/](https://snapshot.org/)
2. Create a Snapshot Credential with the proposal ID created from step1 on [https://galxe.com/](https://galxe.com/)
3. Create an OAT campaign ONLY with the credential created from step2 on [https://galxe.com/](https://galxe.com/)

### 2. Add Galxe Plugin to your space

In Snapshot space setting, you can search and find the Galxe Plugin in the plugins section, and add it to your space.

### 3. Set config JSON

Add campaign and proposal info to your plugin.

First, click the plugin, then you will see an editor section. See example below:

_Specific JSON format like this, and you could use more than 1 OAT in your space:_

```javascript
{
	"oats": {
		"<proposal ID 1>": "<Space Name>/campaign/<Campaign ID>",
		"<proposal ID 2>": "<Space Name>/campaign/<Campaign ID>",
		"<proposal ID 3>": "<Space Name>/campaign/<Campaign ID>",
	}
}
```

notice: The domain should not included in <Space Name>.

#### Usually you don't need to change api part unless you know which api you are using.

````javascript
{
	"api": "https://graphigo.stg.galaxy.eco/query",
	"oats": {
		"0x554ca2bd7d979e8b72c6ae6415946a7bb470da9f60a9cf931205f083c03632a3": "jokey/campaign/GCixQUUqfE"
	}
}

Second, fill it with the proposal ID and the information of the Campaign which you would like to link with the proposal. If you have multiple proposals which all distribute OATs to voters, you can also add multiple proposalID-campaignInfo pairs at one time.

**Notice:** if you delete a proposalID-campaignInfo pair, people won’t see the OAT information on the page of your proposal even if the proposal ends or the OATs have already been distributed.

*Here is a Demo:*
```javascript
{
	"oats": {
		"0x554ca2bd7d979e8b72c6ae6415946a7bb470da9f60a9cf931205f083c03632a3": "galaxy/campaign/GCcqvUtDaM"
	}
}
````

### More

For Production Environment, we are using API Base Url https://graphigo.prd.galaxy.eco/query and only allows domain snapshot.org.
For Local Environment or any other test purpose, you can switch the API Base Url(_file index.ts_) to https://graphigo.stg.galaxy.eco/query and change port to 3000(_file package.json_).

When you see "Access-Control-Allow-Origin" error on console, please check if you have set the correct API Base Url and correct port, then restart the server.
