const list = {
  ex: async (conn, length) => {
    const exList = await conn.query("SELECT * FROM base_ex");
    let result;
    switch (length) {
      case 1:
        result = exList.map((el, i) => `${i + 1}: ${el.name};\n`).join("");
        break;
      case 2:
        result = exList
          .map(
            (el, i) => `${i + 1}: ${el.name}.\nОписание: ${el.description}\n`
          )
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
  },

  day: async (conn, user, dayNo, length) => {
    // добавить багфикс на пустые дни
    const userData = await conn.query(
      `SELECT user_data FROM users WHERE user_tg_id='${user}'`
    );
    const exList = await conn.query("SELECT * FROM base_ex");
    const day = JSON.parse(userData[0].user_data).days[dayNo - 1];

    let result = `День ${dayNo}:\n`;

    for (let ex in day) {
      const currentEx = exList.find(
        (el) => el.base_ex_id == day[ex].base_ex_id
      );
      if (!currentEx) {
        console.log("Ошибка, такого ID упражнения не существует");
        return;
      }
      result += `🎯${currentEx.name}\n`;
      if (length > 1) {
        result += `${day[ex].sets} подходов по ${day[ex].times} раз`;
        if (day[ex].weight) {
          result += ` с весом ${day[ex].weight}`;
        }
        result += ".\n";
      }
    }

    return result;
  },

  allDays: async (conn, user, length) => {
    const userData = await conn.query(
      `SELECT user_data FROM users WHERE user_tg_id='${user}'`
    );
    const week = JSON.parse(userData[0].user_data).days;
    let result = "";
    for (let i = 0; i < week.length; i++) {
      result += await list.day(conn, user, i + 1, 1);
    }
    return result;
  },
};

export default list;
