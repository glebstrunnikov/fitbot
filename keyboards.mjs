const keyboards = {
  // базовая клавиатура, используется чаще всего
  base: {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [
          { text: 'Главное меню', callback_data: 'default' },
          { text: 'Показать упражнения', callback_data: 'show_exes' },
        ],
        [
          { text: 'Создать упражнение', callback_data: 'create_ex' },
          { text: 'Удалить упражнение', callback_data: 'delete_ex' },
        ],
        [
          { text: 'Создать день', callback_data: 'create_day' },
          { text: 'Удалить день', callback_data: 'delete_day' },
        ],
        [
          { text: 'Редактировать день', callback_data: 'edit_day' },
          { text: 'Тренироваться', callback_data: 'workout' },
        ],
      ],
    }),
  },
  // клвиатура, занимающая минимум место, с кнопкой перехода в главное меню и еще одной, программируемой
  escape: (secondOptionText, secondOptionData) => {
    if (secondOptionText && secondOptionData) {
      return {
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [
              { text: 'Главное меню', callback_data: 'default' },
              { text: secondOptionText, callback_data: secondOptionData },
            ],
          ],
        }),
      };
    }
    return {
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [{ text: 'Назад в главное меню', callback_data: 'default' }],
        ],
      }),
    };
  },
  // клавиатура для редактирования дня (добавления/удаления упражнений),
  editDay: (dayNo) => {
    return {
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [
            {
              text: 'Добавить упражнение',
              callback_data: `add_ex_day_${dayNo}`,
            },
          ],
          [
            {
              text: 'Удалить упражнение',
              callback_data: `delete_ex_day_${dayNo}`,
            },
            { text: 'Главное меню', callback_data: 'default' },
          ],
        ],
      }),
    };
  },

  // настраиваемая клавиатура, используется по факту для для выдачи списка либо дней, либо упражнений в дне, чтобы можно было выбрать одним кликом. Для выбора упражнений из базы не используется, потому что он, теоретически, может стать очень большой
  custom: (buttons, mode, dummyText, named) => {
    const keyboard = buttons.map((el, i) => [
      {
        text: dummyText + (!named ? +i + 1 : el),
        callback_data: mode + (Number(i) + 1),
      },
    ]);
    keyboard.push([{ text: 'Главное меню', callback_data: 'default' }]);
    return {
      reply_markup: JSON.stringify({
        inline_keyboard: keyboard,
      }),
    };
  },

  // клавиатура, которая выдается на экране обновления показателей упражнения
  ex: (backData) => {
    return {
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [{ text: 'Назад', callback_data: backData }],
          [
            { text: 'Посмотреть видео', callback_data: 'show_video' },
            { text: 'Главное меню', callback_data: 'default' },
          ],
        ],
      }),
    };
  },

  // специальная клавиатура, которая выдается при предложении прислать видео упражнения. escape тут не подходит, потому что главное меню по факту посылает команду unsave, удаляющую последнее сохраненное упражнение
  createEx: {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [
          { text: 'Назад в главное меню', callback_data: 'unsave' },
          { text: 'Сохранить без видео', callback_data: 'default' },
        ],
      ],
    }),
  },

  // единственная в боте не inline-клавиатура, настраивается и выдает список клавиш
  btnList: (list, dummyText, attribute) => {
    return {
      reply_markup: JSON.stringify({
        keyboard: list.map((el, i) => {
          return [
            {
              text: `${dummyText}${i + 1}${
                el[attribute] ? `: ${el[attribute]}` : ''
              }`,
            },
          ];
        }),
      }),
    };
  },

  // даже не клавиатура, а объект, удаляющий btnList
  rm: {
    reply_markup: JSON.stringify({
      remove_keyboard: true,
    }),
  },
};

export default keyboards;
