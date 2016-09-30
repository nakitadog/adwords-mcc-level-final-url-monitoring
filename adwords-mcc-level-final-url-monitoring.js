//New version that executes in parallel.
//Processes all accounts by label.
//Updated on Friday, September 30, 2016

var strYourEmailAddress = "YOUR_EMAIL@YOUR_DOMAIN.com";

function main() {
	Logger.log('Starting to check final URLs for all active accounts - ' + Date().toString());

	var accountIterator = getAccountsByLabel("Active");

	accountIterator.executeInParallel("processClientAccount", "afterProcessAllClientAccounts");
}

function processClientAccount() {
	var strEmailNotes = "";
	var bThereWereProblems = false;

	var clientAccount = AdWordsApp.currentAccount();

	// Process a client account here.
	Logger.log('Checking account - ' + clientAccount.getName());

	//Grab all final URLs within this account.
	var allFinalURLs = GetFinalUrls(clientAccount);
	//Logger.log('allFinalURLs for account %s: number(%s) %s', clientAccount.getName(),allFinalURLs.length,allFinalURLs);

	//now I need to check each URL
	var problemURLs = checkFinalUrls(allFinalURLs);

	//did we have any problem URLs?
	if (problemURLs.length > 0) {
		bThereWereProblems = true;
		Logger.log('In this account %s, there were problems with these %s URLs: %s', clientAccount.getName(),problemURLs.length,problemURLs);
		strEmailNotes = strEmailNotes + '\nIn this account ' + clientAccount.getName() + ', there were problems with these ' + problemURLs.length + ' URLs:\n' + problemURLs.join("\n") + '\n\n'
	}

	//Store which account we checked:
	var jsonObj = {
		"CheckedClientAccount": clientAccount.getName() + "(" + clientAccount.getCustomerId() + ") URLs Checked (" + allFinalURLs.length + ")",
		"bThereWereProblems": false,
		"strEmailNotes": strEmailNotes
	};

	// return a result, as a text.
	return JSON.stringify(jsonObj);
}


function afterProcessAllClientAccounts(results) {
	var strEmailNotes = "";
	var bThereWereProblems = false;
	var strCheckedAccounts = [];


	for (var i = 0; i < results.length; i++) {
		var resultObj = JSON.parse(results[i].getReturnValue());

		//Store which accounts we checked:
		strCheckedAccounts.push(resultObj.CheckedClientAccount);
		strEmailNotes = strEmailNotes + resultObj.strEmailNotes;

		if (resultObj.bThereWereProblems == true ){
			bThereWereProblems = true;
		}

		Logger.log('resultObj.CheckedClientAccount: %s', resultObj.CheckedClientAccount);
		Logger.log('resultObj.bThereWereProblems: %s', resultObj.bThereWereProblems);
		Logger.log('resultObj.strEmailNotes: %s', resultObj.strEmailNotes);
	}

	// Process your client account here.
	if (bThereWereProblems == true ){
		//Send email telling of the problems
		sendEmail(strYourEmailAddress,strEmailNotes);
	}
	else {
		//Send email only between 10:00 AM till 11:00 AM Pacific coast.
		var currentDate = new Date();
		var currentTime = currentDate.getHours() + ':' + currentDate.getMinutes();

		// Time based on Pacific Standard Time.
		var time1 = '10:00';
		var time2 = '11:00';
		//var time2 = '23:00';

		if (currentTime >= time1 && currentTime <= time2){
			Logger.log('Email the report because - the currentTime was ' + currentTime);

			//Here we need to sort the array of checked accounts
			strCheckedAccounts.sort(
			function(a, b){
				if (a.toLowerCase() < b.toLowerCase()) return -1;
				if (a.toLowerCase() > b.toLowerCase()) return 1;
				return 0;
			});

			//Build the body of the email
			strEmailNotes = "There were no issues with any of the AdWords final URLs. \n\n" + "The following accounts were checked: \n\n\t" + strCheckedAccounts.join("\n\t");

			//Now sent the email
			sendEmail(strYourEmailAddress, strEmailNotes);
		}
		else {
			//don't report anything because it was not between 10:00 and 11:00.
			Logger.log('Don\'t email the report. currentTime was ' + currentTime);
		}
	}

	// optionally, return a result, as a text.
	return "";
}


function checkFinalUrls(allFinalURLs) {
	var problemURLs = [];
	Logger.log('Checking %s URLs.', allFinalURLs.length);
	for (var i = 0; i < allFinalURLs.length; i++) {
		if (allFinalURLs[i] == null) {
			continue;
		}
		var status = getUrlStatus(encodeURI(allFinalURLs[i]));
		if (status !== 200) {
			problemURLs.push("Status: " + status + " - " + allFinalURLs[i]);
		}
		Logger.log('Status %s for finalURL %s', status,allFinalURLs[i]);
	}
	return problemURLs;
}

function GetFinalUrls(account) {
	var allAdURLs = getAdLinks(account);
	var allSiteLinkURLs = getAllSitelinkURLs(account);
	var allFinalURLs = allAdURLs.concat(allSiteLinkURLs);
	var uniqueURLs = uniqBy(allFinalURLs, JSON.stringify);

	return uniqueURLs;
}

uniqBy = function(ary, key) {
	var seen = {};
	return ary.filter(function(elem) {
		var k = key(elem);
		return (seen[k] === 1) ? 0 : seen[k] = 1;
	})
}

function getAdLinks(account){
	MccApp.select(account);
	var adsIterator = AdWordsApp.ads()
	.withCondition("Status = 'ENABLED' and AdGroupStatus = ENABLED and CampaignStatus = ENABLED")
	.get();

	var URLs = [];
	for (var row = 2; adsIterator.hasNext(); row ++) {
		var ad = adsIterator.next();
		var adFinalUrl = ad.urls().getFinalUrl();
		var URL = adFinalUrl.split("?")
		URLs.push(URL[0]);
	}
	return URLs.sort();
}

function getAllSitelinkURLs(account) {
	//Run through all campaign level sitelinks
	MccApp.select(account);

	var campaignIterator = AdWordsApp.campaigns().withCondition("Status = 'ENABLED' and CampaignStatus = ENABLED").get();

	var SiteLinkURLs = [];
	for (var row = 0; campaignIterator.hasNext(); row ++) {
		var campaign = campaignIterator.next();
		var sitelinksIterator = campaign.extensions().sitelinks().get();
		while (sitelinksIterator.hasNext()){
			var sitelink = sitelinksIterator.next();
			if (sitelink.urls().getFinalUrl() === null){
				//do nothing.

			} else {
				var SiteLinkURL = sitelink.urls().getFinalUrl().split("?");
				SiteLinkURLs.push(SiteLinkURL[0]);
			}
		}
	}
	Logger.log('[' + account.getName() + '] Total count of campaign level sitelinks: ' + SiteLinkURLs.length);


	//Run through all ad group level sitelinks
	MccApp.select(account);
	var adGroupIterator = AdWordsApp.adGroups().withCondition("Status = 'ENABLED' and AdGroupStatus = ENABLED").get();

	if (typeof SiteLinkURLs === 'undefined') {
		// variable is undefined
		var SiteLinkURLs = [];
	}

	for (var row = 0; adGroupIterator.hasNext(); row ++) {
		var adgroup = adGroupIterator.next();
		var sitelinksIterator = adgroup.extensions().sitelinks().get();
		while (sitelinksIterator.hasNext()){
			var sitelink = sitelinksIterator.next();
			//Logger.log('Sitelink text: ' + sitelink.getLinkText() ', Sitelink final URL: ' + sitelink.urls().getFinalUrl() + ', mobile preferred: ' + sitelink.isMobilePreferred());
			var SiteLinkURL = sitelink.urls().getFinalUrl().split("?")
			SiteLinkURLs.push(SiteLinkURL[0]);
		}
	}
	Logger.log('[' + account.getName() + '] Total count of ad group level sitelinks: ' + sitelinksIterator.totalNumEntities());


	//Run through all account level sitelinks
	if (typeof SiteLinkURLs === 'undefined') {
		// variable is undefined
		var SiteLinkURLs = [];
	}

	var sl = AdWordsApp.extensions().sitelinks().withCondition("CampaignStatus = ENABLED").get();
	while (sl.hasNext()) {
		var sitelink = sl.next();

		var SiteLinkURL = sitelink.urls().getFinalUrl().split("?")
		SiteLinkURLs.push(SiteLinkURL[0]);

		//Logger.log(sitelink.urls().getFinalUrl());
	}

	Logger.log('[' + account.getName() + '] Total count of account level sitelinks: ' + sl.totalNumEntities());
	return SiteLinkURLs.sort();
}

function getUrlStatus(url) {
	try{
		var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, validateHttpsCertificates: true});

		if (response.getResponseCode()!== 200){
			Logger.log("URL Error: %s \n %s",response.getResponseCode(), response);
		}
		return response.getResponseCode();
	} catch(e){
		Logger.log("URL Error: %s \n %s",url, e);
		return e
	}
}

function sendEmail(emailToAddresses, myBody) {
	if (emailToAddresses != '') {
		//now send.
		Logger.log("Sending email to %s this is the body: %s",emailToAddresses, myBody);
		MailApp.sendEmail(emailToAddresses,'MCC Link Checker Script', myBody);

	}
}

function getAccountsByLabel(sLabelName) {
	// Only CONTAINS and DOES_NOT_CONTAIN operators are supported.
	var accountIterator = MccApp.accounts()
	.withCondition("LabelNames CONTAINS '"+ sLabelName +"'");

	return accountIterator;
}
