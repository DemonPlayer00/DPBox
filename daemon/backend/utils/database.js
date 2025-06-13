const mariadb = require('mariadb');
const private = require('./private');

// 创建连接池
const pool = mariadb.createPool({
    host: 'localhost',
    user: 'root',
    database: 'DPBox',
    password: private.dbPassword,
    connectionLimit: 5
});

async function query(query, params) {
    let connection;
    try {
        connection = await pool.getConnection();
        const result = await connection.query(query, params);
        return result;
    } catch (error) {
        console.error(error);
        return null;
    } finally {
        if (connection) {
            connection.end();
        }
    }
}

module.exports = {
    query
};
