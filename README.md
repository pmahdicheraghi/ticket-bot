# Telegram Bot with Cloudflare Workers

This is a simple Telegram bot that uses Cloudflare Workers to receive messages and send them to a Telegram chat. It also has a simple command to register the webhook.

## Setup:

1. Get your new bot token from [@BotFather](https://t.me/botfather): https://core.telegram.org/bots#6-botfather
2. Sign up to Cloudflare Workers: https://workers.cloudflare.com/
3. In the Cloudflare Dashboard go to "Workers & Pages", then click "Create application" and then "Create worker"
4. Choose a name and click "Deploy" to create the worker
5. Create KV namespace in the Cloudflare Dashboard from path "Workers & Pages" -> "KV" -> "Create Namespace". Choose a name and click "Save"
6. Back to the worker, go to the "Settings" tab 
7. In "KV Namespace Bindings" add a new binding with the name `RESERVE_LIST` and the value of your KV namespace name
8. Add a new environment variable with the name `BOT_TOKEN` and the value of your bot token from [@BotFather](https://t.me/botfather)
9. Add a new environment variable with the name `SECRET_PATH` and set the value to a random secret. See https://core.telegram.org/bots/api#setwebhook
10. Add a new environment variable with the name `ADMIN_ID` and set the value to your Telegram user id.
11. Go to the "Triggers" tab and add a new cron trigger with value `* * * * *` to run the worker every minute
11. Click on "Quick Edit" to change the source code of your new worker
12. Copy and paste the code from [worker.js](worker.js) into the editor
13. Optional: Change the `WEBHOOK` variable to a different path. See https://core.telegram.org/bots/api#setwebhook
14. Click on "Save and Deploy"
15. In the middle panel append `/registerWebhook` to the url. For example: https://my-worker-123.username.workers.dev/registerWebhook
16. Click "Send". In the right panel should appear `Ok`. If 401 Unauthorized appears, you may have used a wrong bot token.
17. That's it, now you can send a text message to your Telegram bot
