# ⏰ Easy 10-Minute Shoutout Automation (No CLI Required)

## Free Option: Uptime Robot

Instead of Cloud Scheduler, use Uptime Robot - it's completely free and super simple!

### Step-by-Step Setup (5 minutes):

1. **Go to Uptime Robot:**
   https://uptimerobot.com/

2. **Create a free account** (no credit card needed)

3. **Click "Add New Monitor"**

4. **Fill in these fields:**
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** `CosmicRaid Shoutouts`
   - **URL:** `https://cosmicraid--studio-5587063777-d2e6c.us-central1.hosted.app/api/cron/shoutouts`
   - **Monitoring Interval:** 10 minutes (select from dropdown)
   - **Monitor Timeout:** 30 seconds
   - **HTTP Method:** POST (if available, otherwise GET works fine)

5. **Click "Create Monitor"**

6. **Done!** 🎉

### What You Get:

✅ Shoutouts run automatically every 10 minutes  
✅ Works 24/7 even when your PC is off  
✅ Completely free forever  
✅ Email alerts if something breaks  
✅ No CLI or complicated setup  

### How to Check It's Working:

1. Wait 10 minutes after setup
2. Check your Discord shoutout channels
3. You should see new shoutouts posted!

### Alternative: Just Use the Button

If you don't want to set up anything:

1. Go to **Settings** in your CosmicRaid app
2. Find the **"Shoutout Automation"** card
3. Click **"Run Shoutout Cycle Now"** every time you want shoutouts

You can do this as often as you like (it has a 10-minute cooldown to prevent spam).

---

## Which Should You Choose?

### Uptime Robot (Recommended):
- ✅ Set it and forget it
- ✅ Runs 24/7 automatically
- ✅ Free forever
- ✅ Super easy setup

### Manual Button:
- ✅ No setup needed
- ✅ Works right now
- ❌ You have to remember to click it
- ❌ Doesn't run when you're away

### Cloud Scheduler (Advanced):
- ✅ Most reliable
- ✅ Native Google Cloud integration
- ❌ Requires gcloud CLI or navigating complex console
- ❌ Costs $0.10/month

---

## Uptime Robot is Perfect For You!

It's literally 5 clicks and you're done. No CLI, no complicated console, just works! 🚀
