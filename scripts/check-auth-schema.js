const { PrismaClient } = require('@prisma/client');

(async () => {
	const prisma = new PrismaClient();
	try {
		console.log('Checking for auth schema and tables...');
		const schemas = await prisma.$queryRawUnsafe(
			"select nspname as schema from pg_namespace where nspname = 'auth'"
		);
		console.log('Schemas:', schemas);

		const tables = await prisma.$queryRawUnsafe(
			"select table_schema, table_name from information_schema.tables where table_schema='auth' order by table_name"
		);
		console.log('Auth tables:', tables);

		const hasUsers = tables.some(
			(t) => t.table_schema === 'auth' && t.table_name === 'users'
		);
		console.log('auth.users present:', hasUsers);
	} catch (e) {
		console.error('Check failed:', e);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
})();
