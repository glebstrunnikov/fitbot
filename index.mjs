import TelegramApi from 'node-telegram-bot-api';

import keyboards from './keyboards.mjs';
import list from './list.mjs';
import onCallbackQuerry from './onCallbackQuerry.mjs';
import onText from './onText.mjs';
import { addVideo, getUserData } from './queries.mjs';

const bot = new TelegramApi(process.env.BOT_TOKEN, { polling: true });

// основная функция, запускающая бота
async function run() {
  // текст - один из двух основных триггеров для бота (второй - инлайн-клавиатура). Текст используется, чтобы получить от пользователя числа, комментарии, названия/описания новых упражнений и другую информацию. В некоторых случаях текст отправляется при помощи reply_keyboard, чтобы не нажимать два раза, но этого лучше избегать, потому что такую клавиатуру потом приходится удалять отдельным сообщением, иначе так и останется висеть.
  bot.on('text', async (msg) => {
    await onText(bot, msg, list, keyboards);
  });

  // Второй основной элемент упарвления ботом - команды с инлайн-клавиатуры. Используются для навигации. Сами клавиатуры отправляются почти после каждого сообщения и находятся в keyboards.js
  bot.on('callback_query', async (msg) => {
    await onCallbackQuerry(bot, msg, list, keyboards);
  });

  // Бот принимает видео только в одном случае - при сохранении нового упражнения.
  bot.on('video', async (msg) => {
    const data = await getUserData(msg.chat.id);
    const mode = data[0].user_mode;
    const reCreateExNo = /^create_ex_/g;
    if (reCreateExNo.test(mode)) {
      const currentExId = mode.replaceAll(reCreateExNo, '');
      await addVideo(msg.video.file_id, currentExId);
    }
    bot.sendMessage(msg.chat.id, 'Спасибо, видео сохранено!', keyboards.base);
  });
}
run();
