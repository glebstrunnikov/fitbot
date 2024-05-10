import dotenv from 'dotenv';
import mariadb from 'mariadb';

dotenv.config();

const conn = await mariadb.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

// ща все допилим и что выше удалим
// из индекса

export async function getUserData(user) {
  return conn.query(`SELECT * FROM users WHERE user_tg_id=${user}`);
}

export async function initialInsert(user) {
  const time = new Date().getTime();
  return conn.query(
    `INSERT INTO users (user_tg_id, user_mode, user_data, user_time) VALUES('${user}', 'default', '{"days":[]}', '${time}')`,
  );
}

export async function getBaseExList() {
  return conn.query('SELECT * FROM base_ex');
}

export async function deleteBaseEx(exId) {
  return conn.query(`DELETE FROM base_ex WHERE base_ex_id='${exId}'`);
}

export async function createBaseEx(name, description) {
  return conn.query(
    `INSERT INTO base_ex (name, description) VALUES('${name}', '${description}')`,
  );
}

export async function getBaseExByName(name) {
  return conn.query(`SELECT base_ex_id FROM base_ex WHERE name='${name}'`);
}

export async function addVideo(videoId, exId) {
  return conn.query(
    `UPDATE base_ex SET video_id='${videoId}' WHERE base_ex_id='${exId}'`,
  );
}

// обновляет информацию в базе по конкретному пользователю
export async function updateData(user, daySet, action) {
  let newData = action(daySet);
  newData = JSON.stringify(newData);
  const time = new Date().getTime();
  return conn.query(
    // `UPDATE users SET user_data = '${newData}' WHERE user_tg_id='${user}';
    // UPDATE users SET user_time = '${time}' WHERE user_tg_id='${user}';`,
    `UPDATE users SET user_data = '${newData}',user_time = '${time}' WHERE user_tg_id = '${user}';`,
  );
}

// обновляет статус пользователя в базе
export async function updateMode(newMode, user) {
  await conn.query(
    `UPDATE users SET user_mode = '${newMode}' WHERE user_tg_id = '${user}'`,
  );
}

// находит упражнение в базе упражнений по айди юзера, номеру его дня и упражнения в нем
// единственное в файле, что не делает запрос в базу, но пусть уж тут будет, куда еще
export async function getEx(daySet, exes, dayNo, exNo) {
  const day = daySet.days[dayNo - 1];
  const exId = day[exNo - 1].base_ex_id;
  const ex = exes.find((el) => el.base_ex_id === exId);
  return ex;
}
