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
};

export default keyboards;
