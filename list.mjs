import { getBaseExList, getUserData } from './queries.mjs';

const list = {
  // список упражнений. Выдается в нескольких вариантах - только названия, с описаниями, с описаниями и командами для выдачи видео
  ex: async (length) => {
    const exList = await getBaseExList();
    let result;
    switch (length) {
      case 1:
        result = exList.map((el, i) => `${i + 1}: ${el.name};\n`).join('');
        break;
      case 2:
        result = exList
          .map(
            (el, i) => `${i + 1}: ${el.name}.\nОписание: ${el.description}\n`,
          )
          .join('');
        break;
      case 3:
        result = exList
          .map(
            (el, i) =>
              `${i + 1}: ${el.name}.\n${
                el.description ? `Описание: ${el.description}\n` : ''
              }${el.video_id ? `Видео: /video_${el.base_ex_id}\n` : ''}`,
          )
          .join('');
        console.log(result);
        break;
      default:
        result = 'Ошибка: вы не указали параметр length в списке упражнений';
        break;
    }
    return `Список упражнений:\n\n${result}`;
  },

  day: async (user, dayNo, length) => {
    const exList = await getBaseExList();
    // добавить багфикс на пустые дни
    const userData = await getUserData(user);
    const day = JSON.parse(userData[0].user_data).days[dayNo - 1];
    let result = `День ${dayNo}:\n`;
    if (day.length === 0) {
      result += '🤷‍♂️Пусто!\n';
    }

    for (const ex in day) {
      if (Object.hasOwn(day, ex)) {
        const currentEx = exList.find(
          (el) => el.base_ex_id === day[ex].base_ex_id,
        );
        if (!currentEx) {
          return 'Ошибка, такого ID упражнения не существует';
        }
        result += `🎯${currentEx.name}\n`;
        if (length > 1) {
          if (day[ex].sets) {
            result += `${day[ex].sets} подходов`;
          }
          if (day[ex].times) {
            result += ` по ${day[ex].times} раз`;
          }
          if (day[ex].weight) {
            result += ` с весом ${day[ex].weight}`;
          }
          if (day[ex].sets) {
            result += '.\n';
          }
        }
      }
    }

    return result;
  },

  allDays: async (user) => {
    const userData = await getUserData(user);

    if (!userData[0].user_data) {
      return 'Дни пока не созданы';
    }
    const week = JSON.parse(userData[0].user_data).days;
    const result = [];
    for (let i = 0; i < week.length; i += 1) {
      result.push(list.day(user, i + 1, 1));
    }
    return (await Promise.all(result)).join('');
  },
};

export default list;
