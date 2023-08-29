import dotenv from "dotenv";
dotenv.config();
import TelegramApi from "node-telegram-bot-api";
import mariadb from "mariadb";
import keyboards from "./keyboards.js";
import list from "./list.js";

const conn = await mariadb.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

const bot = new TelegramApi(process.env.BOT_TOKEN, { polling: true });

const listEx = (length) => list.ex(conn, length);
const listDay = (user, dayNo, length) => list.day(conn, user, dayNo, length);
const listAllDays = (user, length) => list.allDays(conn, user, length);

async function updateData(user, action) {
  const userData = await conn.query(
    `SELECT user_data FROM users WHERE user_tg_id='${user}'`
  );

  if (userData[0].user_data === "" || userData[0].user_data === null) {
    return conn.query(
      `UPDATE users SET user_data='{"days":[[]]}' WHERE user_tg_id='${user}'`
    );
    // НЕ КРИТИЧНО, НО ЗАВИСАЕТ
  } else {
    userData[0].user_data = JSON.parse(userData[0].user_data);
    action(userData[0].user_data);
    userData[0].user_data = JSON.stringify(userData[0].user_data);
    return conn.query(
      `UPDATE users SET user_data = '${userData[0].user_data}' WHERE user_tg_id='${user}'`
    );
  }
}

async function updateMode(newMode, user) {
  await conn.query(
    `UPDATE users SET user_mode = '${newMode}' WHERE user_tg_id = '${user}'`
  );
}

async function run() {
  bot.on("text", async (msg) => {
    const text = msg.text;
    const chat = msg.chat.id;
    const userId = msg.chat.id;

    let data = await conn.query(
      `SELECT * FROM users WHERE user_tg_id=${userId}`
    );
    const exList = await conn.query("SELECT * FROM base_ex");

    if (data.length === 0) {
      await conn.query(
        `INSERT INTO users (user_tg_id, user_mode, user_data) VALUES('${userId}', 'default', '{"days":[]}')`
      );
      data = await conn.query(`SELECT * FROM users WHERE user_tg_id=${userId}`);
      bot.sendMessage(chat, "Кажется, вы у нас в первый раз! Добро пожаловать");
    }

    if (text === "/start") {
      bot.sendMessage(
        chat,
        "Итак, что я могу вам предложить\n",
        keyboards.base
      );
    }

    const mode = data[0].user_mode;
    switch (mode) {
      case "create_ex": {
        await conn.query(
          `INSERT INTO base_ex (name, description) VALUES('${
            text.split("\n")[0]
          }', '${text.split("\n")[1] ?? ""}')`
        );

        const currentExId = await conn.query(
          `SELECT base_ex_id FROM base_ex WHERE name='${text.split("\n")[0]}'`
        );
        // здесь должна быть проверочка на совпадение имен, надо выпиливать последнее при совпадении
        console.log(currentExId[0].base_ex_id);
        updateMode(`create_ex_${currentExId[0].base_ex_id}`, chat);

        bot.sendMessage(
          chat,
          `Теперь пришлите видео, если есть`,
          keyboards.createEx
        );
        break;
      }
      case "delete_ex": {
        const exIdToDelete = exList[Number(text - 1)].base_ex_id;
        conn.query(`DELETE FROM base_ex WHERE base_ex_id='${exIdToDelete}'`);
        bot.sendMessage(
          chat,
          `Упражнение удалено. Новый список упражнений: ${await listEx(1)}`,
          keyboards.base
        );
        break;
      }
      case "delete_day": {
        const dayToDelete = Number(text.replaceAll(/^.*\s/g, "")) - 1;
        await updateData(chat, (data) => data.days.splice(dayToDelete, 1));
        bot.sendMessage(chat, "День удален", keyboards.rm);
        bot.sendMessage(
          chat,
          `Вот новый список дней: \n\n${await listAllDays(chat)}`,
          keyboards.base
        );
        break;
      }
      case "edit_day": {
        const dayToEdit = Number(text.replaceAll(/^.*\s/g, ""));
        await updateMode(`edit_day_${dayToEdit}`, chat);
        bot.sendMessage(
          chat,
          `Вы редактируете день ${dayToEdit}`,
          keyboards.rm
        );
        bot.sendMessage(
          chat,
          `${await listDay(chat, dayToEdit, 2)}`,
          keyboards.editDay(dayToEdit)
        );
        break;
      }
      default:
        if (/^add_ex_day_\d$/.test(mode)) {
          const dayNo = mode.replaceAll(/add_ex_day_/g, "");
          const payload = text.split("\n");
          const exList = await conn.query("SELECT * FROM base_ex");
          await updateData(chat, (data) => {
            data.days[dayNo - 1].push({
              base_ex_id: exList[payload[0] - 1].base_ex_id,
              sets: payload[1] ?? "",
              times: payload[2] ?? "",
              weight: payload[3] ?? "",
              comment: payload[4] ?? "",
            });
          });
          bot.sendMessage(
            chat,
            `Упражнение добавлено в день. Теперь день выглядит так:\n\n${await listDay(
              chat,
              dayNo,
              2
            )}\n\nВы можете добавить еще упражнение таким же способом: номер упражнения из списка, количество подходов, количество повторов, вес (если есть) и комментарий (если есть). Каждое - с новой строки. Или вернуться в главное меню.\n\n${await listEx(
              1
            )}`,
            keyboards.escape
          );
        }

        if (/^delete_ex_day_\d$/.test(mode)) {
          const dayNo = mode.replaceAll(/delete_ex_day_/g, "");
          await updateData(chat, (data) => {
            data.days[dayNo - 1].splice(text - 1, 1);
          });
          bot.sendMessage(
            chat,
            `Упражнение удалено из дня. Теперь день выглядит так:\n\n${await listDay(
              chat,
              dayNo,
              2
            )}`
          );
        }
        if (/workout_\d_\d$/.test(mode)) {
          const exNo = mode.replaceAll(/^workout_\d_/g, "");
          const dayNo = mode.replaceAll(/^workout_/g, "")[0];
          const newData = text.split("\n");
          await updateData(chat, (data) => {
            data.days[dayNo - 1][exNo - 1].sets = newData[0];
            data.days[dayNo - 1][exNo - 1].times = newData[1];
            if (data.days[dayNo - 1][exNo - 1].weight) {
              data.days[dayNo - 1][exNo - 1].weight = newData[2];
            }
            if (data.days[dayNo - 1][exNo - 1].comment) {
              data.days[dayNo - 1][exNo - 1].comment = newData.comment;
            }
          });
          const userData = await conn.query(
            `SELECT user_data FROM users WHERE user_tg_id='${chat}'`
          );
          const day = JSON.parse(userData[0].user_data).days[dayNo - 1];
          const exId = day[exNo - 1].base_ex_id;
          const exes = await conn.query("SELECT * FROM base_ex");
          const ex = exes.find((el) => el.base_ex_id === exId);
          updateMode(`workout_${dayNo}_${exNo}`, chat);

          bot.sendMessage(
            chat,
            `Записали прогресс, ура! 💪\n\n${ex.name}\n\n${
              day[exNo - 1].sets
            } подходов по ${day[exNo - 1].times} раз${
              day[exNo - 1].weight ? " с весом " + day[exNo - 1].weight : ""
            }\n\nЧтобы обновить результат, пришлите новое количество подходов, повторов, вес и комментарий (все — с новой строки)`,
            keyboards.ex(`workout_${dayNo}`)
          );
        }
        break;
    }
  });

  bot.on("callback_query", async (msg) => {
    const chat = msg.message.chat.id;
    const mode = msg.data;

    switch (mode) {
      case "default":
        updateMode(mode, chat);
        bot.sendMessage(
          chat,
          `Список дней с упражнениями:\n\n${await listAllDays(chat)}`,
          keyboards.base
          // keyboards.custom([1, 2, 3], "default")
        );
        break;
      case "show_exes":
        updateMode(mode, chat);
        bot.sendMessage(chat, await listEx(2), keyboards.base);
        break;
      case "create_ex":
        updateMode(mode, chat);
        bot.sendMessage(
          chat,
          `Пришлите название нового упражнения и его описание (с новой строки)`,
          keyboards.escape
        );
        break;
      case "delete_ex": {
        updateMode(mode, chat);
        bot.sendMessage(
          chat,
          `Пришлите номер упражнения, которое хотите удалить \n\n${await listEx(
            1
          )}`,
          keyboards.escape
        );
        break;
      }
      case "create_day": {
        let success;
        await updateData(chat, (data) => {
          if (data.days.length <= 9) {
            success = true;
            data.days.push([]);
          } else {
            success = false;
          }
        });
        if (success === true) {
          bot.sendMessage(
            chat,
            `День создан. Нажмите "редактировать", чтобы добавить в него упражнения. Список дней: ${await listAllDays(
              chat
            )}`,
            keyboards.base
          );
        }
        if (success === false) {
          bot.sendMessage(
            chat,
            `Нельзя создать больше 10 дней`,
            keyboards.base
          );
        }
        updateMode("default");
        break;
      }
      case "delete_day": {
        updateMode(mode, chat);
        const userData = await conn.query(
          `SELECT user_data FROM users WHERE user_tg_id='${chat}'`
        );
        const days = JSON.parse(userData[0].user_data).days;
        bot.sendMessage(
          chat,
          `Выберите день, чтобы удалить его. Список дней:\n\n${await listAllDays(
            chat
          )}`,
          keyboards.btnList(days, "День ")
        );
        break;
      }
      case "edit_day": {
        updateMode(mode, chat);
        const userData = await conn.query(
          `SELECT user_data FROM users WHERE user_tg_id='${chat}'`
        );
        const days = JSON.parse(userData[0].user_data).days;
        bot.sendMessage(
          chat,
          `Какой день по счету будем редактировать? Пришлите число.\n\n${await listAllDays(
            chat
          )}`,
          keyboards.btnList(days, "День ")
          // keyboards.escape
        );
        break;
      }
      case "workout": {
        updateMode(mode, chat);
        const userData = await conn.query(
          `SELECT user_data FROM users WHERE user_tg_id='${chat}'`
        );
        const days = JSON.parse(userData[0].user_data).days;

        bot.sendMessage(
          chat,
          `Супер, удачной тренировки! Выберите, какой сегодня день:\n\n${await listAllDays(
            chat
          )}`,
          keyboards.custom(days, "workout_", "День ")
        );
        break;
      }
      case "unsave": {
        const data = await conn.query(
          `SELECT * FROM users WHERE user_tg_id=${chat}`
        );
        const currentExId = data[0].user_mode.replaceAll(/^create_ex_/g, "");
        await conn.query(
          `DELETE FROM base_ex WHERE base_ex_id='${currentExId}'`
        );
        bot.sendMessage(
          chat,
          `Вы снова в главном меню. Список дней с упражнениями:\n\n${await listAllDays(
            chat
          )}`,
          keyboards.base
        );
        updateMode("default", chat);
        break;
      }
      case "show_video": {
        const data = await conn.query(
          `SELECT * FROM users WHERE user_tg_id=${chat}`
        );
        const mode = data[0].user_mode;
        const exNo = mode.replaceAll(/^workout_\d_/g, "");
        const dayNo = mode.replaceAll(/^workout_/g, "")[0];
        const day = JSON.parse(data[0].user_data).days[dayNo - 1];
        const exId = day[exNo - 1].base_ex_id;
        const exes = await conn.query("SELECT * FROM base_ex");
        const ex = exes.find((el) => el.base_ex_id === exId);
        if (ex.video_id) {
          bot.sendVideo(chat, ex.video_id);
        } else {
          bot.sendMessage(
            chat,
            "Нет видео для этого упражнения!",
            keyboards.escape
          );
        }

        break;
      }

      default:
        if (/^add_ex_day_\d$/.test(mode)) {
          const dayNo = mode.replaceAll(/add_ex_day_/g, "");
          updateMode(`add_ex_day_${dayNo}`, chat);
          bot.sendMessage(
            chat,
            `Пришлите номер упражнения из списка, количество подходов, количество повторов, вес (если есть) и комментарий (если есть). Каждое - с новой строки \n\n${await listEx(
              1
            )}`,
            keyboards.escape
          );
          break;
        }
        if (/^delete_ex_day_\d$/.test(mode)) {
          const dayNo = mode.replaceAll(/delete_ex_day_/g, "");
          updateMode(`delete_ex_day_${dayNo}`, chat);
          bot.sendMessage(
            chat,
            `Пришлите номер упражнения, которое хотите удалить из дня.\n\n${await listDay(
              chat,
              dayNo
            )}`,
            keyboards.escape
          );
        }
        if (/^workout_\d$/.test(mode)) {
          const dayNo = mode.replaceAll(/workout_/g, "");
          updateMode(`workout_${dayNo}`, chat);
          const userData = await conn.query(
            `SELECT user_data FROM users WHERE user_tg_id='${chat}'`
          );
          const exes = await conn.query("SELECT * FROM base_ex");
          const day = JSON.parse(userData[0].user_data).days[dayNo - 1];
          const dayArr = day.map((el) => {
            return exes.find((ex) => ex.base_ex_id == el.base_ex_id).name;
          });
          bot.sendMessage(
            chat,
            `Отлично! Вот ваша программа на сегодня, выберите упражнение, чтобы начать:\n\n${await listDay(
              chat,
              dayNo,
              2
            )}`,
            keyboards.custom(dayArr, `workout_${dayNo}_`, "", true)
          );
        }
        if (/workout_\d_\d$/.test(mode)) {
          const exNo = mode.replaceAll(/^workout_\d_/g, "");
          const dayNo = mode.replaceAll(/^workout_/g, "")[0];
          const userData = await conn.query(
            `SELECT user_data FROM users WHERE user_tg_id='${chat}'`
          );
          const day = JSON.parse(userData[0].user_data).days[dayNo - 1];
          const exId = day[exNo - 1].base_ex_id;
          const exes = await conn.query("SELECT * FROM base_ex");
          const ex = exes.find((el) => el.base_ex_id === exId);
          updateMode(`workout_${dayNo}_${exNo}`, chat);

          bot.sendMessage(
            chat,
            `Текущее упражнение: ${ex.name}\n\n${
              day[exNo - 1].sets
            } подходов по ${day[exNo - 1].times} раз${
              day[exNo - 1].weight ? " с весом " + day[exNo - 1].weight : ""
            }\n\nЧтобы обновить результат, пришлите новое количество подходов, повторов, вес и комментарий (все — с новой строки)`,
            keyboards.ex(`workout_${dayNo}`)
          );
        }
    }
  });

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
  });
}
run();

// в listEx переделать, чтоб описания не показывались, если их нет
// багфиксы
// валидаторы
// клавиатура после отправки видео
// клавиатура после удаления упражнения из дня
// Сделать чтоб при добавлении упражнения в день можно было не указывать подходы/разы
// Что если удаляется из каталога упражнение, которое есть в днях?
