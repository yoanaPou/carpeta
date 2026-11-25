// Datos de conexión del proyecto pa supabase
const SUPABASE_URL = 'https://ibkrgpgkkmuykfglanxj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlia3JncGdra211eWtmZ2xhbnhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzU4MzUsImV4cCI6MjEwODYxMTgzNX0._caDWgysnXkd2q0OtPfpP4mZ8Xsep_bx-3CdNOY6wMs';

// Nombre de mi tabla supabase
const TABLA = 'yoana_peña_aparicio';
// Nombre del bucket de Storage
const BUCKET = 'documentos';
// mi nombre completo front end
const NOMBRE_ALUMNO = 'Yoana Peña Aparicio';

// 'supabase' viene del script CDN; creamos el cliente que usaremos en todo el proyecto
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
