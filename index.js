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

const conn = await mariadb.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

const bot = new TelegramApi(process.env.BOT_TOKEN, { polling: true });

// функции для формирования списков упражнений в базе/дней/одного дня с упражнениями. Эти списки выдаются в сообщениях для пользователя
const listEx = (length) => list.ex(conn, length);
const listDay = (user, dayNo, length) => list.day(conn, user, dayNo, length);
const listAllDays = (user, length) => list.allDays(conn, user, length);

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

async function run() {
  bot.on("text", async (msg) => {
    const text = msg.text;
    const chat = msg.chat.id;
    const userId = msg.chat.id;

    const exList = await conn.query("SELECT * FROM base_ex");
    let userData = await conn.query(
      `SELECT * FROM users WHERE user_tg_id=${userId}`
    );
    if (userData.length === 0) {
      await conn.query(
        `INSERT INTO users (user_tg_id, user_mode, user_data) VALUES('${userId}', 'default', '{"days":[]}')`
      );
      userData = await conn.query(
        `SELECT * FROM users WHERE user_tg_id=${userId}`
      );
      bot.sendMessage(chat, "Кажется, вы у нас в первый раз! Добро пожаловать");
    }
    const days = JSON.parse(userData[0].user_data).days;
    if (text === "/start") {
      bot.sendMessage(
        chat,
        "Итак, что я могу вам предложить\n",
        keyboards.base
      );
    }

    if (/^\/video_\d+$/.test(text)) {
      const exId = text.replaceAll(/\/video_/g, "");
      const ex = exList.find((ex) => ex.base_ex_id == exId);
      bot.sendVideo(
        userId,
        ex.video_id,
        keyboards.escape("Показать упражнения", "show_exes")
      );
    }

    const mode = userData[0].user_mode;
    switch (mode) {
      case "create_ex": {
        if (/^.+\n.+$/.test(text) || /^.+$/.test(text)) {
          await conn.query(
            `INSERT INTO base_ex (name, description) VALUES('${
              text.split("\n")[0]
            }', '${text.split("\n")[1] ?? ""}')`
          );

          const currentExId = await conn.query(
            `SELECT base_ex_id FROM base_ex WHERE name='${text.split("\n")[0]}'`
          );
          // здесь должна быть проверочка на совпадение имен, надо выпиливать последнее при совпадении
          updateMode(`create_ex_${currentExId[0].base_ex_id}`, chat);

          bot.sendMessage(
            chat,
            `Теперь пришлите видео, если есть`,
            keyboards.createEx
          );
          break;
        } else {
          bot.sendMessage(
            chat,
            "Вы ошиблись с форматированием, попробуйте еще раз"
          );
          break;
        }
      }
      case "delete_ex": {
        if (!/\d+/.test(text)) {
          bot.sendMessage(
            chat,
            "Вы ошиблись с форматированием, попробуйте еще раз"
          );
          break;
        }
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
        if (!/^\d\d?$/.test(text)) {
          bot.sendMessage(
            chat,
            "Вы ошиблись с форматированием, попробуйте еще раз"
          );
          break;
        }
        const dayToDelete = Number(text.replaceAll(/^.*\s/g, "")) - 1;
        await updateData(chat, (data) => data.days.splice(dayToDelete, 1));
        await bot.sendMessage(chat, "День удален", keyboards.rm);
        bot.sendMessage(
          chat,
          `Вот новый список дней: \n\n${await listAllDays(chat)}`,
          keyboards.base
        );
        break;
      }
      case "edit_day": {
        if (!/^День \d\d?$/.test(text)) {
          bot.sendMessage(
            chat,
            "Вы ошиблись с форматированием, попробуйте еще раз"
          );
          break;
        }
        const dayToEdit = Number(text.replaceAll(/^.*\s/g, ""));
        await updateMode(`edit_day_${dayToEdit}`, chat);
        await bot.sendMessage(
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
          if (!/^(\d\d?\n)(\d\d?\n)?(\d\d?\n)?(.+?)?$/.test(text)) {
            bot.sendMessage(
              chat,
              "Вы ошиблись с форматированием, попробуйте еще раз"
            );
            break;
          }
          const dayNo = mode.replaceAll(/add_ex_day_/g, "");
          const payload = text.split("\n");

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
            keyboards.escape()
          );
        }

        if (/^delete_ex_day_\d$/.test(mode)) {
          if (!/^\d: .+/.test(text)) {
            bot.sendMessage(
              chat,
              "Вы ошиблись с форматированием, попробуйте еще раз"
            );
            break;
          }
          const dayNo = mode.replaceAll(/delete_ex_day_/g, "");
          const exIdToDelete = Number(mode.replaceAll(/^.*_/g, ""));
          await updateData(chat, (data) => {
            data.days[dayNo - 1].splice(exIdToDelete, 1);
          });
          await bot.sendMessage(
            chat,
            "Упражнение удалено из дня",
            keyboards.rm
          );
          bot.sendMessage(
            chat,
            `Теперь день выглядит так:\n\n${await listDay(chat, dayNo, 2)}`,
            keyboards.editDay(dayNo)
          );
        }
        if (/workout_\d_\d$/.test(mode)) {
          if (!/^(\d\d?\n)(\d\d?\n)?(\d\d?\n)?(.+?)?$/.test(text)) {
            bot.sendMessage(
              chat,
              "Вы ошиблись с форматированием, попробуйте еще раз"
            );
            break;
          }
          const exNo = mode.replaceAll(/^workout_\d_/g, "");
          const dayNo = mode.replaceAll(/^workout_/g, "")[0];
          const newData = text.split("\n");
          console.log(newData);
          await updateData(chat, (data) => {
            data.days[dayNo - 1][exNo - 1].sets = newData[0];
            data.days[dayNo - 1][exNo - 1].times = newData[1];
            if (newData[2]) {
              data.days[dayNo - 1][exNo - 1].weight = newData[2];
            }
            if (newData[3]) {
              data.days[dayNo - 1][exNo - 1].comment = newData[3];
            }
          });
          const day = days[dayNo - 1];
          const ex = await getEx(chat, dayNo, exNo);

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

    const exList = await conn.query("SELECT * FROM base_ex");
    let userData = await conn.query(
      `SELECT * FROM users WHERE user_tg_id=${chat}`
    );
    if (userData.length === 0) {
      await conn.query(
        `INSERT INTO users (user_tg_id, user_mode, user_data) VALUES('${chat}', 'default', '{"days":[]}')`
      );
      userData = await conn.query(
        `SELECT * FROM users WHERE user_tg_id=${chat}`
      );
      bot.sendMessage(chat, "Кажется, вы у нас в первый раз! Добро пожаловать");
    }
    const days = JSON.parse(userData[0].user_data).days;

    switch (mode) {
      case "default":
        updateMode(mode, chat);
        await bot.sendMessage(chat, "Вы в главном меню", keyboards.rm);
        bot.sendMessage(
          chat,
          `Список дней с упражнениями:\n\n${await listAllDays(chat)}`,
          keyboards.base
        );
        break;
      case "show_exes":
        updateMode(mode, chat);
        bot.sendMessage(chat, await listEx(3), keyboards.base);
        break;
      case "create_ex":
        updateMode(mode, chat);
        bot.sendMessage(
          chat,
          `Пришлите название нового упражнения и его описание (с новой строки)`,
          keyboards.escape()
        );
        break;
      case "delete_ex": {
        updateMode(mode, chat);
        bot.sendMessage(
          chat,
          `Пришлите номер упражнения, которое хотите удалить \n\n${await listEx(
            1
          )}`,
          keyboards.escape()
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
        bot.sendMessage(
          chat,
          `Какой день по счету будем редактировать?\n\n${await listAllDays(
            chat
          )}`,
          keyboards.btnList(days, "День ")
          // keyboards.escape
        );
        break;
      }
      case "workout": {
        updateMode(mode, chat);
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
        const currentExId = userData[0].user_mode.replaceAll(
          /^create_ex_/g,
          ""
        );
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
        const previousMode = userData[0].user_mode;
        const exNo = previousMode.replaceAll(/^workout_\d_/g, "");
        const dayNo = previousMode.replaceAll(/^workout_/g, "")[0];
        const ex = await getEx(chat, dayNo, exNo);
        if (ex.video_id) {
          bot.sendVideo(chat, ex.video_id, keyboards.ex(`workout_${dayNo}`));
        } else {
          bot.sendMessage(
            chat,
            "Нет видео для этого упражнения!",
            keyboards.escape()
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
            keyboards.escape()
          );
          break;
        }
        if (/^delete_ex_day_\d$/.test(mode)) {
          const dayNo = mode.replaceAll(/delete_ex_day_/g, "");
          updateMode(`delete_ex_day_${dayNo}`, chat);

          const day = JSON.parse(userData[0].user_data).days[dayNo - 1];
          const list = day.map((el) =>
            exList.find((ex) => ex.base_ex_id == el.base_ex_id)
          );

          bot.sendMessage(
            chat,
            `Выберите упражнение, которое хотите удалить из дня.\n\n${await listDay(
              chat,
              dayNo
            )}`,
            keyboards.btnList(list, "", "name")
          );
        }
        if (/^workout_\d$/.test(mode)) {
          const dayNo = mode.replaceAll(/workout_/g, "");
          updateMode(`workout_${dayNo}`, chat);
          const day = days[dayNo - 1];
          const dayArr = day.map((el) => {
            return exList.find((ex) => ex.base_ex_id == el.base_ex_id).name;
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
          const day = days[dayNo - 1];
          const ex = getEx(chat, dayNo, exNo);
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

// Добавить возможность смотреть видео из каталога упражнений
// в listEx переделать, чтоб описания не показывались, если их нет
// багфиксы
//+ валидаторы
//+ клавиатура после отправки видео
//+ клавиатура перед удплением упражнения из дня
//+ клавиатура после удаления упражнения из дня
//+ Сделать чтоб при добавлении упражнения в день можно было не указывать подходы/разы
// Что если удаляется из каталога упражнение, которое есть в днях?
