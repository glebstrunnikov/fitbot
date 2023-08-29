const keyboards = {
  base: {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [
          { text: "Главное меню", callback_data: "default" },
          { text: "Показать упражнения", callback_data: "show_exes" },
        ],
        [
          { text: "Создать упражнение", callback_data: "create_ex" },
          { text: "Удалить упражнение", callback_data: "delete_ex" },
        ],
        [
          { text: "Создать день", callback_data: "create_day" },
          { text: "Удалить день", callback_data: "delete_day" },
        ],
        [
          { text: "Редактировать день", callback_data: "edit_day" },
          { text: "Тренироваться", callback_data: "workout" },
        ],
      ],
    }),
  },

  escape: {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [
          { text: "Главное меню", callback_data: "default" },
          { text: "Показать упражнения", callback_data: "show_exes" },
        ],
      ],
    }),
  },

  editDay: (dayNo) => {
    if (!dayNo)
      return {
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [{ text: "Добавить упражнение", callback_data: "add_ex_day" }],
            [
              { text: "Удалить упражнение", callback_data: "delete_ex_day" },
              { text: "Главное меню", callback_data: "default" },
            ],
          ],
        }),
      };
    else
      return {
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [
              {
                text: "Добавить упражнение",
                callback_data: `add_ex_day_${dayNo}`,
              },
            ],
            [
              {
                text: "Удалить упражнение",
                callback_data: `delete_ex_day_${dayNo}`,
              },
              { text: "Главное меню", callback_data: "default" },
            ],
          ],
        }),
      };
  },

  custom: (buttons, mode, dummyText, named) => {
    const keyboard = buttons.map((el, i) => [
      {
        text: dummyText + (!named ? +i + 1 : el),
        callback_data: mode + (Number(i) + 1),
      },
    ]);
    keyboard.push([{ text: "Главное меню", callback_data: "default" }]);
    return {
      reply_markup: JSON.stringify({
        inline_keyboard: keyboard,
      }),
    };
  },

  ex: (backData) => {
    return {
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [{ text: "Назад", callback_data: backData }],
          [
            { text: "Напомнить", callback_data: "show_video" },
            { text: "Главное меню", callback_data: "default" },
          ],
        ],
      }),
    };
  },

  createEx: {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [
          { text: "Назад в главное меню", callback_data: "unsave" },
          { text: "Сохранить без видео", callback_data: "default" },
        ],
      ],
    }),
  },

  btnList: (list, dummyText, attribute) => {
    return {
      reply_markup: JSON.stringify({
        keyboard: list.map((el, i) => {
          return [
            {
              text: `${dummyText}${i + 1}${
                el[attribute] ? ": " + el[attribute] : ""
              }`,
            },
          ];
        }),
        // one_time_keyboard: true,
      }),
    };
  },

  rm: {
    reply_markup: JSON.stringify({
      remove_keyboard: true,
    }),
  },
};

export default keyboards;
