import { PrismaClient } from '@prisma/client';

// Create a single instance of PrismaClient
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['query', 'error', 'warn'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Database helper functions
export class DatabaseClient {
  constructor() {
    this.prisma = prisma;
  }

  // AUTH (Supabase) helpers
  async findAuthUserByEmail(email) {
    const rows = await this.prisma.$queryRaw`select id, email, encrypted_password, confirmed_at, email_confirmed_at, created_at from auth.users where lower(email)=lower(${email}) and (deleted_at is null) limit 1`;
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async findAuthUserById(userId) {
    const rows = await this.prisma.$queryRaw`select id, email, created_at from auth.users where id=${userId} and (deleted_at is null) limit 1`;
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  // User operations
  async createUser(userData) {
    return await this.prisma.user.create({
      data: userData
    });
  }

  async findUserByEmail(email) {
    return await this.prisma.user.findUnique({
      where: { email }
    });
  }

  async findUserById(id) {
    return await this.prisma.user.findUnique({
      where: { id }
    });
  }

  // Sensor operations
  async getSensorsForUser(userId, userEmail) {
    // Use raw SQL to avoid Prisma type conversion issues (sensor_type can be enum/text)
    const ownedSensors = await this.prisma.$queryRaw`
      select 
        s.sensor_id    as "sensorId",
        s.sensor_name  as "sensorName",
        s.sensor_name  as "name",
        s.metric       as "metric",
        s.sensor_type::text as "sensorType",
        s.latest_temp  as "latestTemp",
        s.approx_time  as "approxTime",
        s.last_fetched_time as "lastFetchedTime",
        s.updated_at   as "updatedAt",
        s.min_limit    as "minLimit",
        s.max_limit    as "maxLimit",
        s.warning_limit as "warningLimit",
        s.status       as "status",
        s.owner_id     as "ownerId",
        s.email_alert  as "emailAlert",
        s.mobile_alert as "mobileAlert"
      from public.sensors s
      where s.owner_id = CAST(${userId} AS uuid)
    `;

    // Get shared sensors via team invitations
    const teamInvitations = await this.prisma.teamInvitation.findMany({
      where: {
        status: 'accepted',
        OR: [
          { userId: userId },
          { email: { equals: userEmail, mode: 'insensitive' } }
        ]
      },
      select: {
        sensorId: true,
        role: true,
        email: true,
        userId: true,
        status: true
      }
    });

    const ownedIds = new Set(ownedSensors.map(s => s.sensorId));
    const shareIds = teamInvitations
      .map(r => r.sensorId)
      .filter(id => id && !ownedIds.has(id));

    let sharedSensors = [];
    if (shareIds.length > 0) {
      sharedSensors = await this.prisma.$queryRaw`
        with ids as (
          select unnest(CAST(${shareIds} AS uuid[])) as id
        )
        select 
          s.sensor_id    as "sensorId",
          s.sensor_name  as "sensorName",
          s.sensor_name  as "name",
          s.metric       as "metric",
          s.sensor_type::text as "sensorType",
          s.latest_temp  as "latestTemp",
          s.approx_time  as "approxTime",
          s.last_fetched_time as "lastFetchedTime",
          s.updated_at   as "updatedAt",
          s.min_limit    as "minLimit",
          s.max_limit    as "maxLimit",
          s.warning_limit as "warningLimit",
          s.status       as "status",
          s.owner_id     as "ownerId",
          s.email_alert  as "emailAlert",
          s.mobile_alert as "mobileAlert"
        from public.sensors s
        join ids on ids.id = s.sensor_id
      `;
    }

    // Map roles to shared sensors
    const roleById = new Map(
      teamInvitations.map(r => [
        r.sensorId, 
        (/full/i.test(r.role || '') || /admin/i.test(r.role || '')) ? 'admin' : 
        (/owner/i.test(r.role || '') ? 'owner' : 'viewer')
      ])
    );

    const byId = new Map();
    ownedSensors.forEach(s => byId.set(s.sensorId, { ...s, accessRole: 'owner' }));
    sharedSensors.forEach(s => {
      if (!byId.has(s.sensorId)) {
        byId.set(s.sensorId, { 
          ...s, 
          accessRole: roleById.get(s.sensorId) || 'viewer' 
        });
      }
    });

    // Build final list in snake_case for API compatibility
    const finalList = Array.from(byId.values()).map((s) => ({
      sensor_id: s.sensorId,
      sensor_name: s.name || s.sensorName || s.sensorId,
      sensor_type: s.sensorType,
      latest_temp: s.latestTemp,
      approx_time: s.approxTime,
      last_fetched_time: s.lastFetchedTime,
      updated_at: s.updatedAt,
      min_limit: s.minLimit,
      max_limit: s.maxLimit,
      warning_limit: s.warningLimit,
      status: s.status,
      email_alert: s.emailAlert,
      mobile_alert: s.mobileAlert,
      access_role: s.accessRole || 'viewer'
    }));

    return finalList.sort((a, b) => (a.sensor_name || '').localeCompare(b.sensor_name || ''));
  }

  async updateSensorThresholds(sensorId, updateData) {
    // Map snake_case API field names to camelCase Prisma field names
    const mappedData = {};
    if (updateData.minLimit !== undefined) mappedData.minLimit = updateData.minLimit;
    if (updateData.maxLimit !== undefined) mappedData.maxLimit = updateData.maxLimit;
    if (updateData.warningLimit !== undefined) mappedData.warningLimit = updateData.warningLimit;
    if (updateData.sensorName !== undefined) mappedData.sensorName = updateData.sensorName;
    if (updateData.metric !== undefined) mappedData.metric = updateData.metric;
    if (updateData.sensorType !== undefined) mappedData.sensorType = updateData.sensorType;
    if (updateData.updatedAt !== undefined) mappedData.updatedAt = updateData.updatedAt;

    return await this.prisma.sensor.update({
      where: { sensorId },
      data: mappedData
    });
  }

  async getSensorById(sensorId) {
    return await this.prisma.sensor.findUnique({
      where: { sensorId }
    });
  }

  // User preferences operations
  async getUserPreferences(userId) {
    // With primary key = user_id, and to avoid enum/text conversion issues use raw SQL
    const rows = await this.prisma.$queryRaw`
      select 
        up.user_id        as "userId",
        up.temp_scale     as "tempScale",
        up.show_temp      as "showTemp",
        up.show_humidity  as "showHumidity",
        up.show_sensors   as "showSensors",
        up.show_users     as "showUsers",
        up.show_alerts    as "showAlerts",
        up.show_notifications as "showNotifications",
        up.time_zone      as "timeZone",
        up.dark_mode      as "darkMode",
        up.username       as "username"
      from public.user_preferences up
      where up.user_id = CAST(${userId} AS uuid)
      limit 1
    `;
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async upsertUserPreferences(userId, preferences) {
    // Use Prisma upsert but map column names
    const mapped = {
      tempScale: preferences.tempScale,
      showTemp: preferences.showTemp,
      showHumidity: preferences.showHumidity,
      showSensors: preferences.showSensors,
      showUsers: preferences.showUsers,
      showAlerts: preferences.showAlerts,
      showNotifications: preferences.showNotifications,
      timeZone: preferences.timeZone,
      darkMode: preferences.darkMode,
      username: preferences.username
    };

    return await this.prisma.userPreferences.upsert({
      where: { userId },
      update: mapped,
      create: { userId, ...mapped }
    });
  }

  // Sensor readings operations
  async getSensorReadings(sensorId, options = {}) {
    const { startTime, endTime } = options;
    const limit = Number.isFinite(options?.limit) ? options.limit : 10000;
    
    let whereClause = { sensorId };
    
    if (startTime || endTime) {
      whereClause.fetchedAt = {};
      if (startTime) whereClause.fetchedAt.gte = new Date(startTime);
      if (endTime) whereClause.fetchedAt.lte = new Date(endTime);
    }

    const orderBy = (startTime || endTime) ? 
      { fetchedAt: 'asc' } : // Chronological order for time ranges
      { fetchedAt: 'desc' };  // Most recent first for latest data

    return await this.prisma.rawReading.findMany({
      where: whereClause,
      orderBy,
      take: limit,
      select: {
        readingValue: true,
        fetchedAt: true,
        approxTime: true,
        timestamp: true
      }
    });
  }

  // Team invitation operations
  async createTeamInvitation(invitationData) {
    return await this.prisma.teamInvitation.create({
      data: invitationData
    });
  }

  async getTeamInvitationsBySensor(sensorId) {
    return await this.prisma.teamInvitation.findMany({
      where: {
        sensorId,
        status: { in: ['pending', 'accepted'] }
      },
      select: {
        email: true,
        role: true,
        status: true,
        userId: true
      }
    });
  }

  async updateTeamInvitation(token, updateData) {
    return await this.prisma.teamInvitation.update({
      where: { token },
      data: updateData
    });
  }

  async deleteTeamInvitation(sensorId, email) {
    return await this.prisma.teamInvitation.deleteMany({
      where: {
        sensorId,
        email,
        status: { in: ['pending', 'accepted'] }
      }
    });
  }

  async deleteTeamInvitationByUserId(sensorId, userId) {
    return await this.prisma.teamInvitation.deleteMany({
      where: {
        sensorId,
        userId,
        status: 'accepted'
      }
    });
  }

  async getTeamInvitationByToken(token) {
    return await this.prisma.teamInvitation.findUnique({
      where: { token }
    });
  }

  // Permission checking
  async canUserAccessSensor(userId, userEmail, sensorId) {
    // Check if user owns the sensor
    const sensor = await this.prisma.sensor.findUnique({
      where: { sensorId },
      select: { ownerId: true }
    });

    if (!sensor) return false;
    if (sensor.ownerId === userId) return true;

    // Check if user has access via team invitation
    const invitation = await this.prisma.teamInvitation.findFirst({
      where: {
        sensorId,
        status: 'accepted',
        OR: [
          { userId: userId },
          { email: { equals: userEmail, mode: 'insensitive' } }
        ]
      }
    });

    return !!invitation;
  }

  async canUserWriteToSensor(userId, sensorId) {
    // Check if user owns the sensor
    const sensor = await this.prisma.sensor.findUnique({
      where: { sensorId },
      select: { ownerId: true }
    });

    if (!sensor) return false;
    if (sensor.ownerId === userId) return true;

    // Check if user has admin access via team invitation
    const invitation = await this.prisma.teamInvitation.findFirst({
      where: {
        sensorId,
        status: 'accepted',
        userId: userId,
        OR: [
          { role: { contains: 'admin', mode: 'insensitive' } },
          { role: { contains: 'full', mode: 'insensitive' } }
        ]
      }
    });

    return !!invitation;
  }

  // Alert preferences operations
  async getAlertPreferences(userId, userEmail, sensorId) {
    // Check if user owns the sensor
    const sensor = await this.prisma.sensor.findUnique({
      where: { sensorId },
      select: { 
        ownerId: true, 
        emailAlert: true, 
        mobileAlert: true 
      }
    });

    if (!sensor) return null;

    // If user is owner, return sensor preferences
    if (sensor.ownerId === userId) {
      return {
        email_alert: sensor.emailAlert || false,
        mobile_alert: sensor.mobileAlert || false,
        role: 'owner',
        email: userEmail,
        user_id: userId
      };
    }

    // Check team invitation for non-owners
    const invitation = await this.prisma.teamInvitation.findFirst({
      where: {
        sensorId,
        status: 'accepted',
        OR: [
          { userId: userId },
          { email: { equals: userEmail, mode: 'insensitive' } }
        ]
      },
      select: {
        emailAlert: true,
        mobileAlert: true,
        role: true,
        email: true,
        userId: true
      }
    });

    if (!invitation) return null;

    return {
      email_alert: invitation.emailAlert || false,
      mobile_alert: invitation.mobileAlert || false,
      role: invitation.role,
      email: invitation.email,
      user_id: invitation.userId
    };
  }

  async updateAlertPreferences(userId, userEmail, sensorId, preferences) {
    // Check if user owns the sensor
    const sensor = await this.prisma.sensor.findUnique({
      where: { sensorId },
      select: { ownerId: true }
    });

    if (!sensor) throw new Error('Sensor not found');

    const updateData = {};
    if (preferences.email_alert !== undefined) updateData.emailAlert = preferences.email_alert;
    if (preferences.mobile_alert !== undefined) updateData.mobileAlert = preferences.mobile_alert;

    // If user is owner, update sensor preferences
    if (sensor.ownerId === userId) {
      const updatedSensor = await this.prisma.sensor.update({
        where: { sensorId },
        data: updateData,
        select: { emailAlert: true, mobileAlert: true }
      });

      return {
        email_alert: updatedSensor.emailAlert,
        mobile_alert: updatedSensor.mobileAlert,
        role: 'owner',
        email: userEmail,
        user_id: userId
      };
    }

    // Update team invitation for non-owners
    const invitation = await this.prisma.teamInvitation.findFirst({
      where: {
        sensorId,
        status: 'accepted',
        OR: [
          { userId: userId },
          { email: { equals: userEmail, mode: 'insensitive' } }
        ]
      }
    });

    if (!invitation) throw new Error('No access to this sensor');

    const updatedInvitation = await this.prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: updateData,
      select: {
        emailAlert: true,
        mobileAlert: true,
        role: true,
        email: true,
        userId: true
      }
    });

    return {
      email_alert: updatedInvitation.emailAlert,
      mobile_alert: updatedInvitation.mobileAlert,
      role: updatedInvitation.role,
      email: updatedInvitation.email,
      user_id: updatedInvitation.userId
    };
  }

  // Close connection
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

export default new DatabaseClient();
