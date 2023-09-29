import axios from 'axios';
import base64 from "base-64";
import utf8 from "utf8";
import { Telegraf, session } from 'telegraf';
import socksProxyAgentPkg from 'socks-proxy-agent';
import moment from 'jalali-moment';

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

let reserveList = [];

const bot = new Telegraf(process.env.BOT_TOKEN, process.env.SOCKS_PROXY_HOST && {
  telegram: {
    agent: new socksProxyAgentPkg.SocksProxyAgent({
      host: process.env.SOCKS_PROXY_HOST,
      port: process.env.SOCKS_PROXY_PORT,
    }),
  },
});

bot.use(session())

bot.start((ctx) => ctx.reply("به ربات رزرو بلیط خوش آمدید.\n برای رزرو بلیط دستور /reserve را ارسال کنید\nو برای کنسل کردن دستور /cancel را ارسال کنید."))

bot.command('reserve', (ctx) => {
  ctx.session = {
    stage: 'chooseRoute',
  }
  ctx.reply('مبدا و مقصدت رو انتخاب کن', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'تهران به قم', callback_data: 'reserveTehranToQom' }],
        [{ text: 'قم به تهران', callback_data: 'reserveQomToTehran' }],
      ]
    }
  });
})

bot.command('cancel', (ctx) => {
  const userReserveList = reserveList.filter(({ user }) => user === ctx.from.id);
  if (userReserveList.length === 0) {
    ctx.reply('شما هیچ رزروی ندارید')
  } else {
    ctx.session = {
      stage: 'cancel',
    }
    ctx.reply('کدام رزرو را میخواهید کنسل کنید؟', {
      reply_markup: {
        inline_keyboard: userReserveList.map(({ from, to, date, time }, index) => ([{ text: `${getCity(from)} به ${getCity(to)} - ${moment.utc(date).format('jYYYY/jMM/jDD')} - ${getTime(time)}`, callback_data: `cancel${index}` }]))
      }
    });
  }
})

bot.action(/cancel(.*)/, (ctx) => {
  if (ctx.session?.stage !== 'cancel') {
    return;
  }
  ctx.answerCbQuery()
  ctx.session = {}
  reserveList.splice(ctx.match[1], 1);
  ctx.reply('رزرو شما کنسل شد')
})

bot.action('reserveTehranToQom', (ctx) => {
  if (ctx.session?.stage !== 'chooseRoute') {
    return;
  }
  ctx.answerCbQuery()
  ctx.session = {
    ...ctx.session,
    stage: 'chooseDate',
    from: 1,
    to: 161,
  }
  ctx.reply('تاریخ حرکت رو انتخاب کن')
})

bot.action('reserveQomToTehran', (ctx) => {
  if (ctx.session?.stage !== 'chooseRoute') {
    return;
  }
  ctx.answerCbQuery()
  ctx.session = {
    ...ctx.session,
    stage: 'chooseDate',
    from: 161,
    to: 1,
  }
  ctx.reply('روز حرکت رو وارد کن')
})

bot.on('text', (ctx) => {
  if (ctx.session?.stage !== 'chooseDate') {
    return;
  }
  const newDate = getDate(ctx.message.text);
  const newParams = {
    ...params,
    From: ctx.session?.from,
    To: ctx.session?.to,
    DepartureDate: newDate,
  }
  ctx.session = {
    ...ctx.session,
    stage: 'chooseTime',
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

})

bot.action(/reserve(.*)/, (ctx) => {
  if (ctx.session?.stage !== 'chooseTime') {
    return;
  }
  ctx.answerCbQuery()
  reserveList.push({
    from: ctx.session?.from,
    to: ctx.session?.to,
    date: ctx.session?.date,
    time: ctx.match[1],
    user: ctx.from.id,
  })
  ctx.session = {}
  ctx.reply('درخواست رزرو شما ثبت شد')
})

bot.launch()

setInterval(checkReserveList, 1000 * 60 * 1);

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

function getDate(jDay) {
  const jalaliMonth = moment().jMonth() + 1;
  const jalaliYear = moment().jYear();
  const jalaliDate = moment(`${jalaliYear}/${jalaliMonth}/${fixNumbers(jDay)}`, 'jYYYY/jMM/jDD');
  return `${jalaliDate.format('YYYY-MM-DD')}T00:00:00`;
}

function getCity(id) {
  const cities = {
    1: 'تهران',
    161: 'قم',
  }
  return cities[id];
}

function encode(params) {
  return base64.encode(utf8.encode(JSON.stringify(params)));
}

function getTime(date) {
  return moment(date).format('HH:mm');
}

function checkReserveList() {
  reserveList = reserveList.filter(({ time }) => moment(time).isAfter(moment()));
  reserveList.forEach(({ from, to, date, time, user }) => {
    const newParams = {
      ...params,
      From: from,
      To: to,
      DepartureDate: date,
    }
    axios.get(apiUrl + encode(newParams))
      .then(response => {
        const result = response.data.result.departing.find(({ departureDateTime, seat }) => departureDateTime === time && seat > 0);
        if (result) {
          bot.telegram.sendMessage(user, `بلیط شما آماده‌ی رزرو است.\n${getCity(from)} به ${getCity(to)} - ${moment.utc(date).format('jYYYY/jMM/jDD')} - ${getTime(time)} - ${result.fullPrice} - ${result.seat}`)
          reserveList.splice(reserveList.findIndex(({ from: f, to: t, date: d, time: t2, user: u }) => from === f && to === t && date === d && time === t2 && user === u), 1);
        }
      }, error => {
        console.log(error);
      })
  })
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
};
