const onCallbackQuerry = async (
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
  // выцепляем все нужные данные из сообщения из базы данных. В данном случае mode - это новый статус пользователя согласно сообщению, которое принял бот. В общем случае этот статус заносится в базу посредством функции updateMode, но не всегда - иногда человек остается там же с точки зрения навигации, но получает, например, видео упражнения
  const chat = msg.message.chat.id;
  const mode = msg.data;
  const exList = await conn.query("SELECT * FROM base_ex");
  const userData = await conn.query(
    `SELECT * FROM users WHERE user_tg_id=${chat}`
  );

  const days = await JSON.parse(userData[0].user_data).days;

  // далее в зависимости от mode, то есть полученного через кнопку inline_keyboard сообщения, бот присваивает человеку новый статус, дает ему новые кнопки и информацию и т.д.
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
        bot.sendMessage(chat, `Нельзя создать больше 10 дней`, keyboards.base);
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
      if (days.length > 0) {
        bot.sendMessage(
          chat,
          `Какой день по счету будем редактировать?\n\n${await listAllDays(
            chat
          )}`,
          keyboards.btnList(days, "День ")
        );
        break;
      } else {
        bot.sendMessage(
          chat,
          "Сначала создайте хотя бы один день!",
          keyboards.base
        );
        break;
      }
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
      const currentExId = userData[0].user_mode.replaceAll(/^create_ex_/g, "");
      await conn.query(`DELETE FROM base_ex WHERE base_ex_id='${currentExId}'`);
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
};

export default onCallbackQuerry;
