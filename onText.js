const onText = async (
  bot,
  msg,
  conn,
  list,
  keyboards,
  updateMode,
  updateData,
  getEx
) => {
  // функции для формирования списков упражнений в базе/дней/одного дня с упражнениями. Эти списки выдаются в сообщениях для пользователя
  const listEx = (length) => list.ex(conn, length);
  const listDay = (user, dayNo, length) => list.day(conn, user, dayNo, length);
  const listAllDays = (user, length) => list.allDays(conn, user, length);

  // текст - один из двух основных триггеров для бота (второй - инлайн-клавиатура). Текст используется, чтобы получить от пользователя числа, комментарии, названия/описания новых упражнений и другую информацию. В некоторых случаях текст отправляется при помощи reply_keyboard, чтобы не нажимать два раза, но этого лучше избегать, потому что такую клавиатуру потом приходится удалять отдельным сообщением, иначе так и останется висеть.

  //Выдергиваем нужную информацию из сообщения
  const text = msg.text;
  const chat = msg.chat.id;
  // Получаем все что нужно из базы данных, если там пусто - прописываем пустую заготовку и снова получаем
  const exList = await conn.query("SELECT * FROM base_ex");
  let userData = await conn.query(
    `SELECT * FROM users WHERE user_tg_id=${chat}`
  );
  if (userData.length === 0) {
    await conn.query(
      `INSERT INTO users (user_tg_id, user_mode, user_data) VALUES('${chat}', 'default', '{"days":[]}')`
    );
    userData = await conn.query(`SELECT * FROM users WHERE user_tg_id=${chat}`);
    bot.sendMessage(chat, "Кажется, вы у нас в первый раз! Добро пожаловать");
  }
  const days = JSON.parse(userData[0].user_data).days;

  if (text === "/start") {
    bot.sendMessage(chat, "Итак, что я могу вам предложить\n", keyboards.base);
  }
  // команда для показа видеозаписи сохраненных в базу упражнений. К сожалению, реализована довольно костыльным методом, потому что кнопку в сообщение вставить нельзя, а инлайн-клавиатуры бы не хватило при большом количестве упражнений
  if (/^\/video_\d+$/.test(text)) {
    const exId = text.replaceAll(/\/video_/g, "");
    const ex = exList.find((ex) => ex.base_ex_id == exId);
    bot.sendVideo(
      chat,
      ex.video_id,
      keyboards.escape("Показать упражнения", "show_exes")
    );
  }
  // mode - режим, в котором перед получением текста находился пользователей, исходя из которого, соответственно, надо решать, что делать с полученным текстом.
  const mode = userData[0].user_mode;
  switch (mode) {
    case "create_ex": {
      if (!/^.+\n.+$/.test(text) && !/^.+$/.test(text)) {
        bot.sendMessage(
          chat,
          "Вы ошиблись с форматированием, попробуйте еще раз"
        );
        break;
      }
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
        await bot.sendMessage(chat, "Упражнение удалено из дня", keyboards.rm);
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
};

export default onText;
