// CREATE DATABASE gymdailybot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
// CREATE USER 'gymdailybot'@'localhost' IDENTIFIED BY '...'
// GRANT ALL PRIVILEGES ON gymdailybot.* TO 'gymdailybot'@'localhost'
// FLUSH PRIVILEGES;
// CREATE TABLE base_ex (base_ex_id int NOT NULL AUTO_INCREMENT, name char(255), description varchar(1000), video_id char(255), PRIMARY KEY(base_ex_id));
// CREATE TABLE users (user_tg_id int, user_mode char(255), user_data longtext, PRIMARY KEY(user_tg_id));

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
    if (/^create_ex_/.test(mode)) {
      const currentExId = mode.replaceAll(/^create_ex_/g, '');
      await addVideo(msg.video.file_id, currentExId);
    }
    bot.sendMessage(msg.chat.id, 'Спасибо, видео сохранено!', keyboards.base);
  });
}
run();

// Что если удаляется из каталога упражнение, которое есть в днях?
// вынести все что связано с базой в отдельный модуль
// сделать все регэкспы констами
// понять что я не так экспортирую и исправить
// понять что сделать с циклом зависимостей и сделать это
