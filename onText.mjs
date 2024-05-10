import {
  createBaseEx,
  deleteBaseEx,
  getBaseExByName,
  getBaseExList,
  getEx,
  getUserData,
  initialInsert,
  updateData,
  updateMode,
} from './queries.mjs';

const onText = async (bot, msg, list, keyboards) => {
  // Выдергиваем нужную информацию из сообщения
  const { text } = msg;
  const chat = msg.chat.id;
  // Получаем все что нужно из базы данных, если там пусто - прописываем пустую заготовку и снова получаем
  const exList = await getBaseExList();
  console.log(await getUserData(chat).length);
  if ((await getUserData(chat).length) === undefined && text === '/start') {
    bot.sendMessage(
      chat,
      'Кажется, вы у нас в первый раз. Здравствуйте!\nИтак, вот что я могу вам предложить\n',
      keyboards.base,
    );
    await initialInsert(chat);
    return;
  }

  const userData = await getUserData(chat);
  const week = JSON.parse(userData[0].user_data);

  // команда для показа видеозаписи сохраненных в базу упражнений. К сожалению, реализована довольно костыльным методом, потому что кнопку в сообщение вставить нельзя, а инлайн-клавиатуры бы не хватило при большом количестве упражнений
  if (/^\/video_\d+$/.test(text)) {
    const exId = text.replaceAll(/\/video_/g, '');
    const currentEx = exList.find((ex) => ex.base_ex_id == exId);
    bot.sendVideo(
      chat,
      currentEx.video_id,
      keyboards.escape('Показать упражнения', 'show_exes'),
    );
  }
  // mode - режим, в котором перед получением текста находился пользователей, исходя из которого, соответственно, надо решать, что делать с полученным текстом.
  const mode = userData[0].user_mode;
  switch (mode) {
    case 'create_ex': {
      // в этом и дальнейших случаях при получении текста используется валидатор на регэкспах. Тут он принимает только либо название нового упражнения, либо название и описание с новой строчки
      if (!/^.+\n.+$/.test(text) && !/^.+$/.test(text)) {
        bot.sendMessage(
          chat,
          'Вы ошиблись с форматированием, попробуйте еще раз',
        );
        break;
      }
      await createBaseEx(text.split('\n')[0], text.split('\n')[1] ?? '');
      const currentEx = await getBaseExByName(text.split('\n')[0]);
      // здесь должна быть проверочка на совпадение имен, надо выпиливать последнее при совпадении. Доработать
      updateMode(`create_ex_${currentEx[0].base_ex_id}`, chat);
      bot.sendMessage(
        chat,
        `Теперь пришлите видео, если есть`,
        keyboards.createEx,
      );
      break;
    }
    case 'delete_ex': {
      if (!/\d+/.test(text)) {
        bot.sendMessage(
          chat,
          'Вы ошиблись с форматированием, попробуйте еще раз',
        );
        break;
      }
      const exIdToDelete = exList[Number(text - 1)].base_ex_id;
      await deleteBaseEx(exIdToDelete);
      bot.sendMessage(
        chat,
        `Упражнение удалено. Новый список упражнений: ${await list.ex(1)}`,
        keyboards.base,
      );
      break;
    }
    case 'delete_day': {
      if (!/^День \d\d?$/.test(text)) {
        bot.sendMessage(
          chat,
          'Вы ошиблись с форматированием, попробуйте еще раз',
        );
        break;
      }
      const dayToDelete = Number(text.replaceAll(/^.*\s/g, '')) - 1;
      await updateData(chat, week, (data) => {
        data.days.splice(dayToDelete, 1);
        return data;
      });
      await bot.sendMessage(chat, 'День удален', keyboards.rm);
      bot.sendMessage(
        chat,
        `Вот новый список дней: \n\n${await list.allDays(chat)}`,
        keyboards.base,
      );
      break;
    }
    case 'edit_day': {
      if (!/^День \d\d?$/.test(text)) {
        bot.sendMessage(
          chat,
          'Вы ошиблись с форматированием, попробуйте еще раз',
        );
        break;
      }
      const dayToEdit = Number(text.replaceAll(/^.*\s/g, ''));
      await updateMode(`edit_day_${dayToEdit}`, chat);
      await bot.sendMessage(
        chat,
        `Вы редактируете день ${dayToEdit}`,
        keyboards.rm,
      );
      bot.sendMessage(
        chat,
        `${await list.day(chat, dayToEdit, 2)}`,
        keyboards.editDay(dayToEdit),
      );
      break;
    }
    default:
      {
        const reAddExDayNo = /^add_ex_day_\d$/;
        if (reAddExDayNo.test(mode)) {
          const reOneToFourDidgits = /^(\d\d?\n?)(\d\d?\n)?(\d\d?\n)?(.+?)?$/;
          if (!reOneToFourDidgits.test(text)) {
            bot.sendMessage(
              chat,
              'Вы ошиблись с форматированием, попробуйте еще раз',
            );
            break;
          }
          const dayNo = mode.replaceAll(/add_ex_day_/g, '');
          const payload = text.split('\n');

          await updateData(chat, week, (data) => {
            data.days[dayNo - 1].push({
              base_ex_id: exList[payload[0] - 1].base_ex_id,
              sets: payload[1] ?? '',
              times: payload[2] ?? '',
              weight: payload[3] ?? '',
              comment: payload[4] ?? '',
            });
            return data;
          });
          bot.sendMessage(
            chat,
            `Упражнение добавлено в день. Теперь день выглядит так:\n\n${await list.day(
              chat,
              dayNo,
              2,
            )}\n\nВы можете добавить еще упражнение таким же способом: номер упражнения из списка, количество подходов, количество повторов, вес (если есть) и комментарий (если есть). Каждое - с новой строки. Или вернуться в главное меню.\n\n${await list.ex(
              1,
            )}`,
            keyboards.escape(),
          );
        }
      }
      {
        const reDeleteExDayNo = /^delete_ex_day_\d$/;
        if (reDeleteExDayNo.test(mode)) {
          if (!/^\d: .+/.test(text)) {
            bot.sendMessage(
              chat,
              'Вы ошиблись с форматированием, попробуйте еще раз',
            );
            break;
          }
          const dayNo = mode.replaceAll(/delete_ex_day_/g, '');
          const exIdToDelete = Number(text.replaceAll(/:.*$/g, '')) - 1;
          await updateData(chat, week, (data) => {
            data.days[dayNo - 1].splice(exIdToDelete, 1);
            return data;
          });
          await bot.sendMessage(
            chat,
            'Упражнение удалено из дня',
            keyboards.rm,
          );
          bot.sendMessage(
            chat,
            `Теперь день выглядит так:\n\n${await list.day(chat, dayNo, 2)}`,
            keyboards.editDay(dayNo),
          );
        }
      }
      {
        const reWorkoutNoNo = /^workout_\d_\d$/;
        if (reWorkoutNoNo.test(mode)) {
          const reOneToThreeDidgitsAndComment =
            /^(\d\d?\n)(\d\d?\n)?(\d\d?\n)?(.+?)?$/;
          if (!reOneToThreeDidgitsAndComment.test(text)) {
            bot.sendMessage(
              chat,
              'Вы ошиблись с форматированием, попробуйте еще раз',
            );
            break;
          }
          const exNo = mode.replaceAll(/^workout_\d_/g, '');
          const dayNo = mode.replaceAll(/^workout_/g, '')[0];
          const newData = text.split('\n');
          await updateData(chat, week, (data) => {
            data.days[dayNo - 1][exNo - 1].sets = newData[0];
            data.days[dayNo - 1][exNo - 1].times = newData[1];
            if (newData[2]) {
              data.days[dayNo - 1][exNo - 1].weight = newData[2];
            }
            if (newData[3]) {
              data.days[dayNo - 1][exNo - 1].comment = newData[3];
            }
            return data;
          });
          const day = week.days[dayNo - 1];
          const ex = await getEx(week, exList, dayNo, exNo);

          updateMode(`workout_${dayNo}_${exNo}`, chat);
          bot.sendMessage(
            chat,
            `Записали прогресс, ура! 💪\n\n${ex.name}\n\n${
              day[exNo - 1].sets
            } подходов по ${day[exNo - 1].times} раз${
              day[exNo - 1].weight ? ` с весом ${day[exNo - 1].weight}` : ''
            }${
              day[exNo - 1].comment
                ? `\nКомментарий: ${day[exNo - 1].comment}`
                : ''
            }\n\nЧтобы обновить результат, пришлите новое количество подходов, повторов, вес и комментарий (все — с новой строки)`,
            keyboards.ex(`workout_${dayNo}`),
          );
        }
      }
      break;
  }
};

export default onText;
