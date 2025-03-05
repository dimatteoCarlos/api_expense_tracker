import dotenv from 'dotenv';
import pg from 'pg';
import pc from 'picocolors';
dotenv.config();

const uri = {
  connectionString: process.env.DATABASE_URI,
  ssl: { rejectUnauthorized: false }, //Esto es vital
  connectionTimeoutMillis: 10000, // Tiempo de espera para la conexión (5 segundos)
  idleTimeoutMillis: 30000, // Tiempo de espera para conexiones inactivas (30 segundos)
};

export const pool = new pg.Pool(uri); // Pool espera un objeto

export async function checkConnection() {
  try {
    await pool.query('SELECT 1');
    console.log(
      pc.italic(pc.yellowBright('Conexión a la base de datos verificada.'))
    ); //Data base connection verifyid
  } catch (error) {
    console.error(
      pc.red('Error al verificar la conexión a la base de datos:', error)
    ); //Error when connecting to data base. Connection not verifyied
    throw error;
  }
}

// pool.on('error', (err) => {
// console.error('Unexpected error on idle client', err);
// Termina la aplicación si hay un error grave
// process.exit(-1);
// });
