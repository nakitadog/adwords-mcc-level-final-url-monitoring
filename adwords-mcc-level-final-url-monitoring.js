var strEmailNotes = "";
var strYourEmailAddress = "YOUR_EMAIL@YOUR_DOMAIN.com";
var strCheckedAccounts = [];

var myaccountIDs = "";

//This is where you would enter all your Client IDs.
//Remember, this is a comma delimited list of IDs 
//I arranged it like this so that it would be easier to read.  
myaccountIDs = myaccountIDs + 'XXX-XXX-XXXX,'; //Your first Client account
myaccountIDs = myaccountIDs + 'XXX-XXX-XXXX' ; //Your second Client account


function main() {
  Logger.log('Starting to check final URLs - ' + Date().toString());
  
  Logger.log('myaccountIDs - ' + myaccountIDs);
  
  var accountIterator = getAccountSelector(myaccountIDs).get();

  var bThereWereProblems = false;
  while (accountIterator.hasNext()) {
    var account = accountIterator.next();    
    
    Logger.log('Checking account - ' + account.getName());
    
    //Grab all final URLs within this account.
    var allFinalURLs = GetFinalUrls(account);
    //Logger.log('allFinalURLs for account %s: number(%s) %s', account.getName(),allFinalURLs.length,allFinalURLs);   
    
    //now I need to check each URL
    var problemURLs = checkFinalUrls(allFinalURLs);
    
    //Store which accounts we checked:
    strCheckedAccounts.push(account.getName() + "(" + account.getCustomerId() + ") URLs Checked (" + allFinalURLs.length + ")" );
    
    //did we have any problem URLs?
    if (problemURLs.length > 0) {
      bThereWereProblems = true;
      Logger.log('In this account %s, there were problems with these %s URLs: %s', account.getName(),problemURLs.length,problemURLs);
      strEmailNotes = strEmailNotes + '\nIn this account ' + account.getName() + ', there were problems with these ' + problemURLs.length + ' URLs:\n' + problemURLs.join("\n") + '\n\n'
    }     
  }
  
  if (bThereWereProblems == true ){
    //Send email telling of the problems
    sendEmail(strYourEmailAddress,strEmailNotes);
  } else {
    //Send email only between 10:00 AM till 11:00 AM Pacific coast.
    var currentDate = new Date();
    var currentTime = currentDate.getHours() + ':' + currentDate.getMinutes();
    // Time based on Pacific Standard Time.
    var time1 = '10:00'; 
    var time2 = '11:00';
    
    if (currentTime >= time1 && currentTime <= time2){
      Logger.log('Email the report because the currentTime was ' + currentTime);
      
      //Here we need to sort the array of checked accounts
      strCheckedAccounts.sort(
        function(a, b) {
          if (a.toLowerCase() < b.toLowerCase()) return -1;
          if (a.toLowerCase() > b.toLowerCase()) return 1;
          return 0;
        }
      );
      
      //Build the body of the email
      strEmailNotes = "There were no issues with any of the AdWords final URLs. \n\n" +
        "The following accounts were checked: \n\n\t" + 
        strCheckedAccounts.join("\n\t");  
      
      //Now sent the email
      sendEmail(strYourEmailAddress, strEmailNotes);  
      
    } else {
      //don't report anything because it was not between 10:00 and 11:00.
      Logger.log('Don\'t email the report. currentTime was ' + currentTime);
     
    }    
  }  
}


function checkFinalUrls(allFinalURLs) {
  var problemURLs = [];
  Logger.log('Checking %s ads.', allFinalURLs.length);
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

function getAccountSelector(clientIDstoCheck) {
  var accountSelector = MccApp.accounts()
      .withIds([clientIDstoCheck]);  
  return accountSelector;
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
  MccApp.select(account);
  var campaignIterator = AdWordsApp.campaigns()
      .withCondition("Status = 'ENABLED' and CampaignStatus = ENABLED")
      .get();
  
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
  return SiteLinkURLs.sort();
}  


function getUrlStatus(url) {
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true});
  if (response.getResponseCode()!== 200){
    Logger.log("URL Error: %s \n %s",response.getResponseCode(), response);  
  }  
  return response.getResponseCode();
}

function sendEmail(emailToAddresses, myBody) {
  if (emailToAddresses != '') {
    //now send.
    Logger.log("Sending email to %s this is the body: %s",emailToAddresses, myBody);
    MailApp.sendEmail(emailToAddresses,'MCC Link Checker Script', myBody);    
    
  }
}
