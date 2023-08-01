import dotenv from "dotenv";
dotenv.config();
import TelegramApi from "node-telegram-bot-api";
import mariadb from "mariadb";

const conn = await mariadb.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

const bot = new TelegramApi(process.env.BOT_TOKEN, { polling: true });

async function listEx(length) {
  const exList = await conn.query("SELECT * FROM base_ex");
  let result;
  switch (length) {
    case 1:
      result = exList.map((el, i) => `${i + 1}: ${el.name};\n`).join("");
      break;
    case 2:
      result = exList
        .map((el, i) => `${i + 1}: ${el.name}.\nОписание: ${el.description}`)
        .join("");
      break;
    case 3:
      result = exList
        .map(
          (el, i) =>
            `${i + 1}: ${el.name}.\nОписание: ${el.description}\n\nВидео: ${
              el.video_url
            }`
        )
        .join("");
      break;
  }
  return "Список упражнений:\n\n" + result;
}

async function run() {
  const baseKeyboard = {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{ text: "Главное меню", callback_data: "default" }],
        [
          { text: "Создать упражнение", callback_data: "createex" },
          { text: "Удалить упражнение", callback_data: "deleteex" },
        ],
      ],
    }),
  };

  bot.on("text", async (msg) => {
    const text = msg.text;
    const chat = msg.chat.id;
    const userId = msg.chat.id;

    let data = await conn.query(
      `SELECT * FROM users WHERE user_tg_id=${userId}`
    );
    const exList = await conn.query("SELECT * FROM base_ex");

    if (data.length === 0) {
      conn.query(
        `INSERT INTO users (user_tg_id, user_mode, user_data) VALUES('${userId}', 'default', '')`
      );
      bot.sendMessage(chat, "Кажется, вы у нас в первый раз! Добро пожаловать");
    } else {
      bot.sendMessage(
        chat,
        `Ваши данные: ${JSON.stringify(data)}`,
        baseKeyboard
      );
    }

    switch (data[0].user_mode) {
      case "createex":
        conn.query(
          `INSERT INTO base_ex (name, description, video_url) VALUES('${
            text.split("\n")[0]
          }', '${text.split("\n")[1] ?? ""}', '${text.split("\n")[2] ?? ""}')`
        );
        break;
      case "deleteex": {
        const exIdToDelete = exList[Number(text - 1)].base_ex_id;
        conn.query(`DELETE FROM base_ex WHERE base_ex_id='${exIdToDelete}'`);
        break;
      }
    }

    // console.log(data[0].user_tg_id);
  });

  bot.on("callback_query", async (msg) => {
    const chat = msg.message.chat.id;
    const mode = msg.data;
    await conn.query(
      `UPDATE users SET user_mode = '${mode}' WHERE user_tg_id = '${chat}'`
    );

    switch (mode) {
      case "createex":
        bot.sendMessage(
          chat,
          `Пришлите название нового упражнения, его описание и ссылку на видео. В три строчки`,
          baseKeyboard
        );
        break;
      case "deleteex":
        bot.sendMessage(
          chat,
          `Пришлите номер упражнения, которое хотите удалить ${await listEx(
            1
          )}`,
          baseKeyboard
        );
    }
  });
}
run();
