const TOKEN = self.BOT_TOKEN
const SECRET = self.SECRET_PATH
const ADMIN_ID = self.ADMIN_ID
const WEBHOOK = '/endpoint'

const aliBabaApiUrl = 'https://ws.alibaba.ir/api/v2/train/available/';

const params = {
  "From": 161,
  "To": 1,
  "DepartureDate": "2023-10-05T00:00:00",
  "TicketType": 1,
  "IsExclusiveCompartment": false,
  "PassengerCount": 1,
  "ReturnDate": null,
  "ServiceType": null,
  "Channel": 1,
  "AvailableTargetType": null,
  "Requester": null,
  "UserId": 0,
  "OnlyWithHotel": false,
  "ForceUpdate": null
}

/**
 * @typedef ReserveList
 * @type {object}
 * @property {string} id - an ID.
 * @property {number} user - chatID.
 * @property {string} from - source.
 * @property {string} to - destination.
 * @property {Date} date - date.
 * @property {string} time - time.
 * @property {boolean} notify - notify.
 */

/** @type {ReserveList[]} */
const reserveList = [];

/**
 * Wait for requests to the worker
 */
addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (url.pathname === WEBHOOK) {
    event.respondWith(handleWebhook(event))
  } else if (url.pathname === '/registerWebhook') {
    event.respondWith(registerWebhook(event, url, WEBHOOK, SECRET))
  } else if (url.pathname === '/unRegisterWebhook') {
    event.respondWith(unRegisterWebhook(event))
  } else {
    event.respondWith(new Response('No handler for this request'))
  }
})

/**
 * Handle requests to WEBHOOK
 * https://core.telegram.org/bots/api#update
 */
async function handleWebhook(event) {
  // Check secret
  if (event.request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== SECRET) {
    return new Response('Unauthorized', { status: 403 })
  }

  // Read request body synchronously
  const update = await event.request.json()
  // Deal with response asynchronously
  event.waitUntil(onUpdate(update))

  return new Response('Ok')
}

/**
 * Handle incoming Update
 * supports messages and callback queries (inline button presses)
 * https://core.telegram.org/bots/api#update
 */
async function onUpdate(update) {
  if ('message' in update) {
    await onMessage(update.message)
  }
  if ('callback_query' in update) {
    await onCallbackQuery(update.callback_query)
  }
}

/**
 * Set webhook to this worker's url
 * https://core.telegram.org/bots/api#setwebhook
 */
async function registerWebhook(event, requestUrl, suffix, secret) {
  // https://core.telegram.org/bots/api#setwebhook
  const webhookUrl = `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`
  const r = await (await fetch(apiUrl('setWebhook', { url: webhookUrl, secret_token: secret }))).json()
  return new Response('ok' in r && r.ok ? 'Ok' : JSON.stringify(r, null, 2))
}

/**
 * Remove webhook
 * https://core.telegram.org/bots/api#setwebhook
 */
async function unRegisterWebhook(event) {
  const r = await (await fetch(apiUrl('setWebhook', { url: '' }))).json()
  return new Response('ok' in r && r.ok ? 'Ok' : JSON.stringify(r, null, 2))
}

/**
 * Return url to telegram api, optionally with parameters added
 */
function apiUrl(methodName, params = null) {
  let query = ''
  if (params) {
    query = '?' + new URLSearchParams(params).toString()
  }
  return `https://api.telegram.org/bot${TOKEN}/${methodName}${query}`
}

/**
 * Send plain text message
 * https://core.telegram.org/bots/api#sendmessage
 */
async function sendPlainText(chatId, text, parse_mode) {
  return (await fetch(apiUrl('sendMessage', parse_mode ? {
    chat_id: chatId,
    text,
    parse_mode,
  } : {
    chat_id: chatId,
    text,
  }))).json()
}

/**
 * Escape string for use in MarkdownV2-style text
 * if `except` is provided, it should be a string of characters to not escape
 * https://core.telegram.org/bots/api#markdownv2-style
 */
function escapeMarkdown(str, except = '') {
  const all = '_*[]()~`>#+-=|{}.!\\'.split('').filter(c => !except.includes(c))
  const regExSpecial = '^$*+?.()|{}[]\\'
  const regEx = new RegExp('[' + all.map(c => (regExSpecial.includes(c) ? '\\' + c : c)).join('') + ']', 'gim')
  return str.replace(regEx, '\\$&')
}

/**
 * Send a message with buttons, `buttons` must be an array of arrays of button objects
 * https://core.telegram.org/bots/api#sendmessage
 */
async function sendInlineButtons(chatId, text, buttons) {
  return (await fetch(apiUrl('sendMessage', {
    chat_id: chatId,
    reply_markup: JSON.stringify({
      inline_keyboard: buttons
    }),
    text
  }))).json()
}

/**
 * Answer callback query (inline button press)
 * This stops the loading indicator on the button and optionally shows a message
 * https://core.telegram.org/bots/api#answercallbackquery
 */
async function answerCallbackQuery(callbackQueryId, text = null) {
  const data = {
    callback_query_id: callbackQueryId
  }
  if (text) {
    data.text = text
  }
  return (await fetch(apiUrl('answerCallbackQuery', data))).json()
}

/**
 * An object that represents a callback query from a Telegram inline keyboard.
 * @typedef {Object} CallbackQuery
 * @property {string} id - Unique identifier for this query.
 * @property {Object} from - Sender of the query.
 * @property {number} from.id - Unique identifier of the sender user or bot.
 * @property {boolean} from.is_bot - True, if this user is a bot.
 * @property {string} from.first_name - Sender's first name.
 * @property {string} from.last_name - Sender's last name.
 * @property {string} from.username - Sender's username.
 * @property {string} from.language_code - IETF language tag of the sender's language.
 * @property {Object} message - Message with the callback button that originated the query.
 * @property {number} message.message_id - Unique message identifier inside this chat.
 * @property {Object} message.from - Sender of the message.
 * @property {number} message.from.id - Unique identifier of the sender user or bot.
 * @property {boolean} message.from.is_bot - True, if this user is a bot.
 * @property {string} message.from.first_name - Sender's first name.
 * @property {string} message.from.last_name - Sender's last name.
 * @property {string} message.from.username - Sender's username.
 * @property {Object} message.chat - Conversation the message belongs to.
 * @property {number} message.chat.id - Unique identifier for this chat.
 * @property {string} message.chat.first_name - Chat's first name.
 * @property {string} message.chat.last_name - Chat's last name.
 * @property {string} message.chat.username - Chat's username.
 * @property {string} message.chat.type - Type of chat, can be either "private", "group", "supergroup" or "channel".
 * @property {number} message.date - Date the message was sent in Unix time.
 * @property {string} message.text - The actual UTF-8 text of the message, 0-4096 characters.
 * @property {Object} message.reply_markup - Additional interface options. A JSON-serialized object for an inline keyboard, custom reply keyboard, instructions to remove reply keyboard or to force a reply from the user.
 * @property {Object[][]} message.reply_markup.inline_keyboard - An array of button rows, each represented by an array of objects of the type InlineKeyboardButton.
 * @property {string} message.reply_markup.inline_keyboard[][].text - Label text on the button.
 * @property {string} message.reply_markup.inline_keyboard[][].callback_data - Data to be sent in a callback query to the bot when button is pressed, 1-64 bytes.
 * @property {string} chat_instance - Global identifier, uniquely corresponding to the chat to which the message with the callback button was sent. Useful for high scores in games.
 * @property {string} data - Data associated with the callback button. Be aware that a bad client can send arbitrary data in this field.
 */


/**
 * Handle incoming callback_query (inline button press)
 * https://core.telegram.org/bots/api#message
 * @param {CallbackQuery} callbackQuery 
 */
async function onCallbackQuery(callbackQuery) {
  await answerCallbackQuery(callbackQuery.id)
  if (callbackQuery.from.id != ADMIN_ID) {
    return sendPlainText(callbackQuery.message.chat.id, 'به ربات رصد بلیط خوش آمدید.\nشما حساب فعال ندارید.\nبرای ثبت نام در بات دستور /register را ارسال کنید.')
  }

  if (callbackQuery.data.startsWith('cancel')) {
    const id = callbackQuery.data.split("cancel")[1];
    const index = reserveList.findIndex((reserve) => reserve.id === id);
    if (index === -1) {
      return sendPlainText(callbackQuery.message.chat.id, 'رزرو پیدا نشد')
    }
    reserveList.splice(index, 1);
    return sendPlainText(callbackQuery.message.chat.id, 'رزرو شما کنسل شد');
  } else if (callbackQuery.data.startsWith('route')) {
    const id = uid()
    const from = callbackQuery.data.split("route")[1];
    const to = callbackQuery.data.split("route")[2];
    reserveList.push({ id, from, to, user: callbackQuery.message.chat.id })
    return sendInlineButtons(callbackQuery.message.chat.id, 'روز حرکت را انتخاب کن', [
      [{ text: 'امروز', callback_data: `day0day${id}` }],
      [{ text: 'فردا', callback_data: `day1day${id}` }],
      [{ text: 'پس فردا', callback_data: `day2day${id}` }],
    ])
  } else if (callbackQuery.data.startsWith('day')) {
    const id = callbackQuery.data.split("day")[2];
    const index = reserveList.findIndex((reserve) => reserve.id === id);
    if (index === -1) {
      return sendPlainText(callbackQuery.message.chat.id, 'رزرو پیدا نشد')
    }
    const day = callbackQuery.data.split("day")[1];
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + Number(day));
    reserveList[index].date = currentDate;
    const res = await (await fetch(aliBabaApiUrl + encode({
      ...params,
      From: reserveList[index].from,
      To: reserveList[index].to,
      DepartureDate: getDateString(currentDate) + 'T00:00:00',
    }))).json()
    if (res.result) {
      return sendInlineButtons(callbackQuery.message.chat.id, 'ساعت حرکت رو انتخاب کن', res.result.departing.map(({ seat, departureDateTime, fullPrice }) => ([{ text: `${getCity(reserveList[index].from, 'fa')} به ${getCity(reserveList[index].to, 'fa')} - ${getTimeString(departureDateTime, 'fa')} - ${fullPrice} - ${seat}`, callback_data: `reserve${departureDateTime}reserve${id}` }])))
    } else {
      return sendPlainText(callbackQuery.message.chat.id, res.error?.message ?? 'دریافت اطلاعات با خطا مواجه شد. لطفا دوباره تلاش کنید', res.error?.message ? 'HTML' : undefined)
    }
  } else if (callbackQuery.data.startsWith('reserve')) {
    const id = callbackQuery.data.split("reserve")[2];
    const index = reserveList.findIndex((reserve) => reserve.id === id);
    if (index === -1) {
      return sendPlainText(callbackQuery.message.chat.id, 'رزرو پیدا نشد')
    }
    const time = callbackQuery.data.split("reserve")[1];
    reserveList[index].time = time;
    reserveList[index].notify = true;
    await checkReservation(id);
    return sendPlainText(callbackQuery.message.chat.id, 'درخواست رصد شما ثبت شد');
  } else if (callbackQuery.data.startsWith('buy')) {
    const id = callbackQuery.data.split("buy")[2];
    const index = reserveList.findIndex((reserve) => reserve.id === id);
    if (index === -1) {
      return sendPlainText(callbackQuery.message.chat.id, 'رزرو پیدا نشد')
    }
    const confirm = callbackQuery.data.split("buy")[1] === "Confirm"
    if (confirm) {
      reserveList.splice(index, 1);
      return sendPlainText(callbackQuery.message.chat.id, 'تایید شد')
    } else {
      reserveList[index].notify = true;
      await checkReservation(id);
      return sendPlainText(callbackQuery.message.chat.id, 'درخواست رصد شما ثبت شد')
    }
  }
}

/**
 * A message object that represents a Telegram message.
 * @typedef {Object} Message
 * @property {number} message_id - Unique message identifier inside this chat.
 * @property {Object} from - Sender of the message.
 * @property {number} from.id - Unique identifier of the sender user or bot.
 * @property {boolean} from.is_bot - True, if this user is a bot.
 * @property {string} from.first_name - Sender's first name.
 * @property {string} from.last_name - Sender's last name.
 * @property {string} from.username - Sender's username.
 * @property {string} from.language_code - IETF language tag of the sender's language.
 * @property {Object} chat - Conversation the message belongs to.
 * @property {number} chat.id - Unique identifier for this chat.
 * @property {string} chat.first_name - Chat's first name.
 * @property {string} chat.last_name - Chat's last name.
 * @property {string} chat.username - Chat's username.
 * @property {string} chat.type - Type of chat, can be either "private", "group", "supergroup" or "channel".
 * @property {number} date - Date the message was sent in Unix time.
 * @property {string} text - The actual UTF-8 text of the message, 0-4096 characters.
 * @property {Object[]} entities - For text messages, special entities like usernames, URLs, bot commands, etc. that appear in the text.
 * @property {number} entities[].offset - Offset in UTF-16 code units to the start of the entity.
 * @property {number} entities[].length - Length of the entity in UTF-16 code units.
 * @property {string} entities[].type - Type of the entity. Can be “mention” (@username), “hashtag” (#hashtag), “cashtag” ($USD), “bot_command” (/start@jobs_bot), “url” (https://telegram.org), “email” (do-not-reply@telegram.org), “phone_number” (+1-212-555-0123), “bold” (bold text), “italic” (italic text), “underline” (underlined text), “strikethrough” (strikethrough text), “code” (monowidth string), “pre” (monowidth block), “text_link” (for clickable text URLs), “text_mention” (for users without usernames).
 */

/**
 * Handle incoming Message
 * https://core.telegram.org/bots/api#message
 * @param {Message} message 
 */
function onMessage(message) {
  if (message.from.id != ADMIN_ID) {
    return sendPlainText(message.chat.id, 'به ربات رصد بلیط خوش آمدید.\nشما حساب فعال ندارید.\nبرای ثبت نام در بات دستور /register را ارسال کنید.')
  }

  if (message.text.startsWith('/start')) {
    return sendPlainText(message.chat.id, 'به ربات رصد بلیط خوش آمدید.\n برای رصد بلیط دستور /watch را ارسال کنید\nو برای کنسل کردن دستور /cancel را ارسال کنید.')
  } else if (message.text.startsWith('/cancel')) {
    if (reserveList.length === 0) {
      return sendPlainText(message.chat.id, 'شما هیچ رزروی ندارید')
    } else {
      return sendInlineButtons(message.chat.id, 'کدام رزرو را میخواهید کنسل کنید؟', reserveList.map(({ from, to, date, time, id }) => ([{ text: `${getCity(from, 'fa')} به ${getCity(to, 'fa')} - ${getDateString(date, 'fa')} - ${getTimeString(time, 'fa')}`, callback_data: `cancel${id}` }])));
    }
  } else if (message.text.startsWith('/watch')) {
    return sendInlineButtons(message.chat.id, 'مبدا و مقصدت رو انتخاب کن', [
      [{ text: 'تهران به قم', callback_data: 'route1route161' }],
      [{ text: 'قم به تهران', callback_data: 'route161route1' }],
    ])
  } else {
    return sendPlainText(message.chat.id, escapeMarkdown('*Unknown command:* `' + message.text + '`\n' + 'Use /help to see available commands.', '*`'), "MarkdownV2")
  }
}


// ------------------------------ Functions -----------------------------------

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getCity(id, lang) {
  const citiesFa = {
    "1": 'تهران',
    "161": 'قم',
  }
  const citiesEn = {
    "1": 'THR',
    "161": 'QUM',
  }
  return lang === 'fa' ? citiesFa[id] : citiesEn[id];
}

function getDateString(date, lang) {
  date = typeof date === 'string' ? new Date(data) : date;
  if (lang === 'fa') {
    return date.toLocaleDateString(lang).slice(0, 10)
  } else {
    return date.toISOString().slice(0, 10)
  }
}

function getTimeString(date, lang) {
  date = typeof date === 'string' ? new Date(date) : date;
  return date.toLocaleTimeString(lang)
}

function encode(params) {
  return btoa(JSON.stringify(params));
}

async function checkReservation(id) {
  const index = reserveList.findIndex((reserve) => reserve.id === id);
  if (index === -1 || reserveList[index].notify === false) {
    return;
  }

  if (new Date(reserveList[index].time).getTime() < Date.now()) {
    reserveList.splice(index, 1);
    return;
  }

  (await fetch(aliBabaApiUrl + encode({
    ...params,
    From: reserveList[index].from,
    To: reserveList[index].to,
    DepartureDate: getDateString(reserveList[index].date) + 'T00:00:00',
  }))).json()
    .then((res) => {
      if (res.result) {
        const result = res.result.departing.find(({ departureDateTime, seat }) => departureDateTime === reserveList[index].time && seat > 0);
        if (result) {
          sendInlineButtons(
            reserveList[index].user,
            `بلیط شما آماده‌ی رزرو است.\n${getCity(reserveList[index].from, 'fa')} به ${getCity(reserveList[index].to, 'fa')} - ${getDateString(reserveList[index].date, 'fa')} - ${getTimeString(reserveList[index].time, 'fa')} - ${result.fullPrice} - ${result.seat}\nhttps://www.alibaba.ir/train/${getCity(reserveList[index].from)}-${getCity(reserveList[index].to)}?adult=1&child=0&infant=0&departing=${reserveList[index].date.toLocaleDateString('fr-CA-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).slice(0,10)}&ticketType=Family&isExclusive=false&isTransitCar=false`,
            [[{ text: 'خریدم', callback_data: `buyConfirmbuy${id}` }, { text: 'دوباره', callback_data: `buyRetrybuy${id}` }]],
          )
          reserveList[index].notify = false;
        }
      }
    })

  setTimeout(() => {
    checkReservation(id);
  }, Math.round((new Date(reserveList[index].time).getTime() - Date.now()) / (24 * 60)) + 10000); // 10 sec + 1 min per day
}