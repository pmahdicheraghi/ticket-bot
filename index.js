import axios from 'axios';
import base64 from "base-64";
import utf8 from "utf8";
import { Telegraf, session } from 'telegraf';
import socksProxyAgentPkg from 'socks-proxy-agent';
import moment from 'jalali-moment';
import uniqid from 'uniqid';

const STAGES = {
  started: "started",
  cancel: "cancel",
  chooseRoute: "chooseRoute",
  chooseDate: "chooseDate",
  acceptDate: "acceptDate",
  chooseTime: "chooseTime",
}

const apiUrl = 'https://ws.alibaba.ir/api/v2/train/available/';

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

const reserveList = [];

const userList = [
  1306678508, // @pmahdicheraghi (admin)
  103475519, // @SAHosseini557
  122463137, // @MeyBS
  583216604, // @Whitte_Nightt
  2070367514, // @Dr_Farghadani
];

const bot = new Telegraf(process.env.BOT_TOKEN, process.env.SOCKS_PROXY_HOST && {
  telegram: {
    agent: new socksProxyAgentPkg.SocksProxyAgent({
      host: process.env.SOCKS_PROXY_HOST,
      port: process.env.SOCKS_PROXY_PORT,
    }),
  },
});

bot.use(session())

bot.start((ctx) => {
  if (userList.includes(ctx.from.id)) {
    ctx.session = { stage: STAGES.started }
    ctx.reply("به ربات رصد بلیط خوش آمدید.\n برای رصد بلیط دستور /watch را ارسال کنید\nو برای کنسل کردن دستور /cancel را ارسال کنید.");
  }
  else {
    ctx.reply("به ربات رصد بلیط خوش آمدید.\nشما حساب فعال ندارید.\nبرای ثبت نام در بات دستور /register را ارسال کنید.");
  }
})

bot.command('register', (ctx) => {
  ctx.reply("فعلا ثبت نام از طریق ربات امکان پذیر نیست.\nدرخواست شما به ادمین ارسال شد.");
  bot.telegram.sendMessage(userList[0], `کاربر جدیدی درخواست ثبت نام کرده است.\nنام کاربری: ‎@${ctx.from.username}\nنام: ${ctx.from.first_name} ${ctx.from.last_name}\nآی دی: ${ctx.from.id}`);
})

bot.command('cancel', (ctx) => {
  if (ctx.session?.stage !== STAGES.started) {
    return;
  }
  const userReserveList = reserveList.filter(({ user }) => user === ctx.from.id);
  if (userReserveList.length === 0) {
    ctx.reply('شما هیچ رزروی ندارید')
  } else {
    ctx.session = { stage: STAGES.cancel }
    ctx.reply('کدام رزرو را میخواهید کنسل کنید؟', {
      reply_markup: {
        inline_keyboard: userReserveList.map(({ from, to, date, time }, index) => ([{ text: `${getCity(from)} به ${getCity(to)} - ${moment.utc(date).format('jYYYY/jMM/jDD')} - ${getTime(time)}`, callback_data: `cancel${index}` }]))
      }
    });
  }
})

bot.action(/cancel(.*)/, (ctx) => {
  if (ctx.session?.stage !== STAGES.cancel) {
    return;
  }
  ctx.answerCbQuery()
  ctx.session = { stage: STAGES.started }
  reserveList.splice(ctx.match[1], 1);
  ctx.reply('رزرو شما کنسل شد')
})

bot.command('watch', (ctx) => {
  if (ctx.session?.stage !== STAGES.started) {
    return;
  }
  ctx.session = { stage: STAGES.chooseRoute }
  ctx.reply('مبدا و مقصدت رو انتخاب کن', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'تهران به قم', callback_data: 'route1-161' }],
        [{ text: 'قم به تهران', callback_data: 'route161-1' }],
      ]
    }
  });
})

bot.action(/route(.*)-(.*)/, (ctx) => {
  if (ctx.session?.stage !== STAGES.chooseRoute) {
    return;
  }
  ctx.answerCbQuery()
  ctx.session = {
    ...ctx.session,
    stage: STAGES.chooseDate,
    from: ctx.match[1],
    to: ctx.match[2],
  }
  ctx.reply('روز حرکت رو به صورت عدد وارد کن (مثلا "۱۸")')
})

bot.on('text', (ctx) => {
  if (ctx.session?.stage !== STAGES.chooseDate) {
    return;
  }
  const newDate = getDate(ctx.message.text);
  ctx.session = {
    ...ctx.session,
    stage: STAGES.acceptDate,
    date: newDate,
  }
  ctx.reply(`تاریخ حرکت رو تایید میکنی؟\n${newDate.format('jYYYY/jMM/jDD')}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'بله', callback_data: 'accyes' }, { text: 'خیر', callback_data: 'accno' }],
      ]
    }
  });
})

bot.action(/acc(.*)/, (ctx) => {
  if (ctx.session?.stage !== STAGES.acceptDate) {
    return;
  }
  ctx.answerCbQuery()
  if (ctx.match[1] === 'no') {
    ctx.session = {
      ...ctx.session,
      stage: STAGES.chooseDate
    }
    ctx.reply('روز حرکت رو به صورت عدد وارد کن (مثلا "۱۸")')
  }
  else {
    const newDate = toMiladi(ctx.session?.date);
    const newParams = {
      ...params,
      From: ctx.session?.from,
      To: ctx.session?.to,
      DepartureDate: newDate,
    }
    ctx.session = {
      ...ctx.session,
      stage: STAGES.chooseTime,
      date: newDate,
    }
    axios.get(apiUrl + encode(newParams))
      .then(response => {
        ctx.reply('ساعت حرکت رو انتخاب کن', {
          reply_markup: {
            inline_keyboard: response.data.result.departing.map(({ seat, departureDateTime, fullPrice }) => ([{ text: `${getCity(ctx.session?.from)} به ${getCity(ctx.session?.to)} ${getTime(departureDateTime)} - ${fullPrice} - ${seat}`, callback_data: `reserve${departureDateTime}` }]))
          }
        })
      }, error => {
        console.log(error);
        ctx.reply('دریافت اطلاعات با خطا مواجه شد. لطفا دوباره تلاش کنید')
      })
  }
})

bot.action(/reserve(.*)/, (ctx) => {
  if (ctx.session?.stage !== STAGES.chooseTime) {
    return;
  }
  ctx.answerCbQuery()
  const id = uniqid();
  reserveList.push({
    id,
    from: ctx.session?.from,
    to: ctx.session?.to,
    date: ctx.session?.date,
    time: ctx.match[1],
    user: ctx.from.id,
    notify: true,
  });
  ctx.session = { stage: STAGES.started }
  ctx.reply('درخواست رصد شما ثبت شد')
  checkReservation(id);
})

bot.action(/buyConfirm(.*)/, (ctx) => {
  ctx.answerCbQuery()
  const reserveIndex = reserveList.findIndex(({ id }) => id === ctx.match[1]);
  if (reserveIndex === -1) {
    return;
  }
  reserveList.splice(reserveIndex, 1);
  ctx.reply('تایید شد');
})

bot.action(/buyRetry(.*)/, (ctx) => {
  ctx.answerCbQuery()
  const reserveIndex = reserveList.findIndex(({ id }) => id === ctx.match[1]);
  if (reserveIndex === -1) {
    return;
  }
  reserveList[reserveIndex].notify = true;
  checkReservation(ctx.match[1]);
  ctx.reply('درخواست رصد شما ثبت شد');
})

bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

function getDate(jDay) {
  const jalaliMonth = moment().jMonth() + (moment().jDate() > parseInt(fixNumbers(jDay)) ? 2 : 1)
  const jalaliYear = moment().jYear();
  const jalaliDate = moment(`${jalaliYear}/${jalaliMonth}/${fixNumbers(jDay)}`, 'jYYYY/jMM/jDD');
  return jalaliDate;
}

function toMiladi(jalaliDate) {
  return `${jalaliDate.format('YYYY-MM-DD')}T00:00:00`;
}

function getCity(id) {
  const cities = {
    1: 'تهران',
    161: 'قم',
  }
  return cities[id];
}

function getEnCity(id) {
  const cities = {
    1: 'THR',
    161: 'QUM',
  }
  return cities[id];
}

function encode(params) {
  return base64.encode(utf8.encode(JSON.stringify(params)));
}

function getTime(date) {
  return moment(date).format('HH:mm');
}

function checkReservation(id) {
  const reserveIndex = reserveList.findIndex((reserve) => reserve.id === id);
  if (reserveIndex === -1 || reserveList[reserveIndex].notify === false) {
    return;
  }
  if (!moment(reserveList[reserveIndex].time).isAfter(moment())) {
    reserveList.splice(reserveIndex, 1);
    return;
  }

  const newParams = {
    ...params,
    From: reserveList[reserveIndex].from,
    To: reserveList[reserveIndex].to,
    DepartureDate: reserveList[reserveIndex].date,
  }

  axios.get(apiUrl + encode(newParams))
    .then((response) => {
      const result = response.data.result.departing.find(({ departureDateTime, seat }) => departureDateTime === reserveList[reserveIndex].time && seat > 0);
      if (result) {
        bot.telegram.sendMessage(reserveList[reserveIndex].user,
          `بلیط شما آماده‌ی رزرو است.\n${getCity(reserveList[reserveIndex].from)} به ${getCity(reserveList[reserveIndex].to)} - ${moment.utc(reserveList[reserveIndex].date).format('jYYYY/jMM/jDD')} - ${getTime(reserveList[reserveIndex].time)} - ${result.fullPrice} - ${result.seat}\nhttps://www.alibaba.ir/train/${getEnCity(reserveList[reserveIndex].from)}-${getEnCity(reserveList[reserveIndex].to)}?adult=1&child=0&infant=0&departing=${moment.utc(reserveList[reserveIndex].date).format('jYYYY/jMM/jDD')}&ticketType=Family&isExclusive=false&isTransitCar=false`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: 'خریدم', callback_data: `buyConfirm${id}` }, { text: 'دوباره', callback_data: `buyRetry${id}` }]]
            }
          })
        reserveList[reserveIndex].notify = false;
      }
    }, (error) => {
      console.log(error);
    })

  setTimeout(() => {
    checkReservation(id);
  }, Math.round(moment(reserveList[reserveIndex].time).diff(moment()) / (24 * 60)) + 10000); // 10 sec + 1 min per day
}

function fixNumbers(str) {
  const persianNumbers = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g]
  const arabicNumbers = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g]
  if (typeof str === 'string') {
    for (var i = 0; i < 10; i++) {
      str = str.replace(persianNumbers[i], i).replace(arabicNumbers[i], i);
    }
  }
  return str;
}
