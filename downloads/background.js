chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  const existing = await chrome.storage.local.get("settings");
  if (!existing.settings) {
    await chrome.storage.local.set({ settings: { setupComplete:false, clubName:"", clubUrl:"", websiteUrl:"", discordUrl:"", twitchUrl:"", affiliateCode:"", signupUrl:"", upgradeUrl:"", defaultSignature:"", memberGoal:250, animationMode:"cinematic", homeClubSlug:"", messageClubSlug:"", defaultMessageType:"announcement", primaryColor:"#262522", accentColor:"#81b64c", customLogoData:"" } });
  }
});
chrome.runtime.onStartup.addListener(async () => { await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }); });
