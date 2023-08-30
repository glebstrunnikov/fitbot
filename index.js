// CREATE DATABASE gymdailybot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
// CREATE USER 'gymdailybot'@'localhost' IDENTIFIED BY '...'
// GRANT ALL PRIVILEGES ON gymdailybot.* TO 'gymdailybot'@'localhost'
// FLUSH PRIVILEGES;
// CREATE TABLE base_ex (base_ex_id int NOT NULL AUTO_INCREMENT, name char(255), description varchar(1000), video_id char(255), PRIMARY KEY(base_ex_id));
// CREATE TABLE users (user_tg_id int, user_mode char(255), user_data longtext, PRIMARY KEY(user_tg_id));

import dotenv from "dotenv";
dotenv.config();
import TelegramApi from "node-telegram-bot-api";
import mariadb from "mariadb";
import keyboards from "./keyboards.js";
import list from "./list.js";
import onText from "./onText.js";
import onCallbackQuerry from "./onCallbackQuerry.js";

const conn = await mariadb.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

const bot = new TelegramApi(process.env.BOT_TOKEN, { polling: true });

// обновляет информацию в базе по конкретному пользователю
async function updateData(user, action) {
  const userData = await conn.query(
    `SELECT user_data FROM users WHERE user_tg_id='${user}'`
  );
  if (userData[0].user_data === "" || userData[0].user_data === null) {
    return conn.query(
      `UPDATE users SET user_data='{"days":[[]]}' WHERE user_tg_id='${user}'`
    );
  } else {
    userData[0].user_data = JSON.parse(userData[0].user_data);
    action(userData[0].user_data);
    userData[0].user_data = JSON.stringify(userData[0].user_data);
    return conn.query(
      `UPDATE users SET user_data = '${userData[0].user_data}' WHERE user_tg_id='${user}'`
    );
  }
}

// обновляет статус пользователя в базе
async function updateMode(newMode, user) {
  await conn.query(
    `UPDATE users SET user_mode = '${newMode}' WHERE user_tg_id = '${user}'`
  );
}

// находит упражнение в базе упражнений по айди юзера, номеру его дня и упражнения в нем
const getEx = async (user, dayNo, exNo) => {
  console.log(user, dayNo, exNo);
  const userData = await conn.query(
    `SELECT user_data FROM users WHERE user_tg_id='${user}'`
  );
  const day = JSON.parse(userData[0].user_data).days[dayNo - 1];
  const exId = day[exNo - 1].base_ex_id;
  const exes = await conn.query("SELECT * FROM base_ex");
  const ex = exes.find((el) => el.base_ex_id === exId);
  return ex;
};

// основная функция, запускающая бота
async function run() {
  // текст - один из двух основных триггеров для бота (второй - инлайн-клавиатура). Текст используется, чтобы получить от пользователя числа, комментарии, названия/описания новых упражнений и другую информацию. В некоторых случаях текст отправляется при помощи reply_keyboard, чтобы не нажимать два раза, но этого лучше избегать, потому что такую клавиатуру потом приходится удалять отдельным сообщением, иначе так и останется висеть.
  bot.on("text", async (msg) => {
    await onText(
      bot,
      msg,
      conn,
      list,
      keyboards,
      updateMode,
      updateData,
      getEx
    );
  });

  // Второй основной элемент упарвления ботом - команды с инлайн-клавиатуры. Используются для навигации. Сами клавиатуры отправляются почти после каждого сообщения и находятся в keyboards.js
  bot.on("callback_query", async (msg) => {
    await onCallbackQuerry(
      bot,
      msg,
      conn,
      list,
      keyboards,
      updateMode,
      updateData,
      getEx
    );
  });

  // Бот принимает видео только в одном случае - при сохранении нового упражнения.
  bot.on("video", async (msg) => {
    const data = await conn.query(
      `SELECT * FROM users WHERE user_tg_id=${msg.chat.id}`
    );
    const mode = data[0].user_mode;
    if (/^create_ex_/.test(mode)) {
      const currentExId = mode.replaceAll(/^create_ex_/g, "");
      conn.query(
        `UPDATE base_ex SET video_id='${msg.video.file_id}' WHERE base_ex_id='${currentExId}'`
      );
    }
    bot.sendMessage(msg.chat.id, "Спасибо, видео сохранено!", keyboards.base);
  });
}
run();

// Что если удаляется из каталога упражнение, которое есть в днях?
