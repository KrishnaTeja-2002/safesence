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
    const rows = await this.prisma.$queryRaw`
      select 
        id, 
        email, 
        encrypted_password,
        email_confirmed_at,
        confirmed_at,
        confirmation_token,
        created_at
      from auth.users 
      where lower(email) = lower(${email}) 
      and deleted_at is null
      limit 1
    `;
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

  // Device operations
  async getDevicesForUser(userId) {
    return await this.prisma.device.findMany({
      where: { ownerId: userId },
      include: {
        sensors: true
      }
    });
  }

  async getDeviceById(deviceId) {
    return await this.prisma.device.findUnique({
      where: { deviceId },
      include: {
        sensors: true
      }
    });
  }

  // Sensor operations - Updated for device-based structure
  async getSensorsForUser(userId, userEmail) {
    // Use SQL to avoid relying on Prisma relations that are not declared in schema
    const rows = await this.prisma.$queryRaw`
      WITH user_devices AS (
        SELECT device_id FROM public.devices 
        WHERE owner_id = CAST(${userId} AS uuid)
      ),
      owned_sensors AS (
        SELECT 
          s.sensor_id, 
          s.sensor_name, 
          s.metric, 
          s.sensor_type, 
          s.latest_temp, 
          s.last_fetched_time,
          s.min_limit,
          s.max_limit,
          s.warning_limit,
          s.status,
          s.email_alert,
          s.mobile_alert,
          s.device_id,
          d.device_name,
          'owner' as access_role
        FROM public.sensors s
        JOIN public.devices d ON s.device_id = d.device_id
        WHERE d.device_id IN (SELECT device_id FROM user_devices)
      ),
      shared_sensors AS (
        SELECT 
          s.sensor_id, 
          s.sensor_name, 
          s.metric, 
          s.sensor_type, 
          s.latest_temp, 
          s.last_fetched_time,
          s.min_limit,
          s.max_limit,
          s.warning_limit,
          s.status,
          s.email_alert,
          s.mobile_alert,
          s.device_id,
          d.device_name,
          CASE 
            WHEN ti.role ILIKE '%admin%' OR ti.role ILIKE '%full%' THEN 'admin'
            WHEN ti.role ILIKE '%owner%' THEN 'owner'
            ELSE 'viewer'
          END as access_role
        FROM public.sensors s
        JOIN public.devices d ON s.device_id = d.device_id
        JOIN public.team_invitations ti ON s.sensor_id = ti.sensor_id
        WHERE ti.status = 'accepted'
          AND (ti.user_id = CAST(${userId} AS uuid) OR lower(ti.email) = lower(${userEmail}))
          AND d.device_id NOT IN (SELECT device_id FROM user_devices)
      )
      SELECT * FROM owned_sensors
      UNION ALL
      SELECT * FROM shared_sensors
      ORDER BY sensor_name;
    `;

    // rows already in API's expected snake_case
    return Array.isArray(rows) ? rows : [];
  }

  async updateSensorThresholds(sensorId, deviceId, updateData) {
    // Raw SQL update using composite key (sensor_id, device_id)
    const sets = [];
    const params = [];
    let idx = 1;
    if (updateData.minLimit !== undefined) { sets.push(`min_limit = $${idx++}`); params.push(updateData.minLimit); }
    if (updateData.maxLimit !== undefined) { sets.push(`max_limit = $${idx++}`); params.push(updateData.maxLimit); }
    if (updateData.warningLimit !== undefined) { sets.push(`warning_limit = $${idx++}`); params.push(updateData.warningLimit); }
    if (updateData.sensorName !== undefined) { sets.push(`sensor_name = $${idx++}`); params.push(updateData.sensorName); }
    if (updateData.metric !== undefined) { sets.push(`metric = $${idx++}`); params.push(updateData.metric); }
    if (sets.length === 0) return await this.getSensorById(sensorId, deviceId);
    const setClause = sets.join(', ');
    const q = `
      UPDATE public.sensors
      SET ${setClause}
      WHERE sensor_id = $${idx++} AND device_id = $${idx++}
      RETURNING sensor_id as "sensorId",
                sensor_name as "sensorName",
                metric,
                -- sensor_type intentionally omitted or we could cast: (sensor_type)::text
                latest_temp as "latestTemp",
                last_fetched_time as "lastFetchedTime",
                min_limit as "minLimit",
                max_limit as "maxLimit",
                warning_limit as "warningLimit",
                (status)::text as "status",
                email_alert as "emailAlert",
                mobile_alert as "mobileAlert",
                device_id as "deviceId";
    `;
    params.push(sensorId, deviceId);
    const rows = await this.prisma.$queryRawUnsafe(q, ...params);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async updateSensorData(sensorId, deviceId, sensorData) {
    const sets = [];
    const params = [];
    let idx = 1;
    if (sensorData.latestTemp !== undefined) { sets.push(`latest_temp = $${idx++}`); params.push(sensorData.latestTemp); }
    if (sensorData.lastFetchedTime !== undefined) { sets.push(`last_fetched_time = $${idx++}`); params.push(sensorData.lastFetchedTime); }
    if (sensorData.minLimit !== undefined) { sets.push(`min_limit = $${idx++}`); params.push(sensorData.minLimit); }
    if (sensorData.maxLimit !== undefined) { sets.push(`max_limit = $${idx++}`); params.push(sensorData.maxLimit); }
    if (sensorData.warningLimit !== undefined) { sets.push(`warning_limit = $${idx++}`); params.push(sensorData.warningLimit); }
    if (sensorData.sensorName !== undefined) { sets.push(`sensor_name = $${idx++}`); params.push(sensorData.sensorName); }
    if (sensorData.metric !== undefined) { sets.push(`metric = $${idx++}`); params.push(sensorData.metric); }
    if (sensorData.sensorType !== undefined) { sets.push(`sensor_type = $${idx++}`); params.push(sensorData.sensorType); }
    if (sets.length === 0) return await this.getSensorById(sensorId, deviceId);
    const setClause = sets.join(', ');
    const q = `
      UPDATE public.sensors
      SET ${setClause}
      WHERE sensor_id = $${idx++} AND device_id = $${idx++}
      RETURNING sensor_id as "sensorId",
                sensor_name as "sensorName",
                metric,
                -- (sensor_type)::text as "sensorType",
                latest_temp as "latestTemp",
                last_fetched_time as "lastFetchedTime",
                min_limit as "minLimit",
                max_limit as "maxLimit",
                warning_limit as "warningLimit",
                (status)::text as "status",
                email_alert as "emailAlert",
                mobile_alert as "mobileAlert",
                device_id as "deviceId";
    `;
    params.push(sensorId, deviceId);
    const rows = await this.prisma.$queryRawUnsafe(q, ...params);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async getSensorById(sensorId, deviceId) {
    // Use raw SQL with composite key and cast enum-like columns to text
    const rows = await this.prisma.$queryRaw`
      select 
        sensor_id    as "sensorId",
        device_id    as "deviceId",
        sensor_name  as "sensorName",
        metric,
        (sensor_type)::text  as "sensorType",
        min_limit    as "minLimit",
        max_limit    as "maxLimit",
        warning_limit as "warningLimit",
        (status)::text as "status"
      from public.sensors
      where sensor_id = ${sensorId} and device_id = ${deviceId}
      limit 1
    `;
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
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
    // Use raw SQL upsert to avoid enum/string type coercion issues
    const rows = await this.prisma.$queryRaw`
      INSERT INTO public.user_preferences (
        user_id,
        temp_scale,
        show_temp,
        show_humidity,
        show_sensors,
        show_users,
        show_alerts,
        show_notifications,
        time_zone,
        dark_mode,
        username
      ) VALUES (
        ${userId}::uuid,
        ${preferences.tempScale}::temp_unit,
        ${!!preferences.showTemp}::boolean,
        ${!!preferences.showHumidity}::boolean,
        ${!!preferences.showSensors}::boolean,
        ${!!preferences.showUsers}::boolean,
        ${!!preferences.showAlerts}::boolean,
        ${!!preferences.showNotifications}::boolean,
        ${preferences.timeZone}::text,
        ${!!preferences.darkMode}::boolean,
        ${preferences.username || null}::text
      )
      ON CONFLICT (user_id) DO UPDATE SET
        temp_scale = EXCLUDED.temp_scale,
        show_temp = EXCLUDED.show_temp,
        show_humidity = EXCLUDED.show_humidity,
        show_sensors = EXCLUDED.show_sensors,
        show_users = EXCLUDED.show_users,
        show_alerts = EXCLUDED.show_alerts,
        show_notifications = EXCLUDED.show_notifications,
        time_zone = EXCLUDED.time_zone,
        dark_mode = EXCLUDED.dark_mode,
        username = EXCLUDED.username
      RETURNING 
        user_id        as "userId",
        temp_scale     as "tempScale",
        show_temp      as "showTemp",
        show_humidity  as "showHumidity",
        show_sensors   as "showSensors",
        show_users     as "showUsers",
        show_alerts    as "showAlerts",
        show_notifications as "showNotifications",
        time_zone      as "timeZone",
        dark_mode      as "darkMode",
        username       as "username";
    `;
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
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
    // Check if user owns the sensor via device ownership
    const sensorRow = await this.prisma.sensor.findUnique({
      where: { sensorId },
      select: { deviceId: true }
    });

    if (!sensorRow) return false;
    const device = await this.prisma.device.findUnique({
      where: { deviceId: sensorRow.deviceId },
      select: { ownerId: true }
    });
    if (device && device.ownerId === userId) return true;

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

  async canUserWriteToSensor(userId, sensorId, deviceId) {
    // Check if user owns the sensor via device ownership (composite key)
    let devId = deviceId;
    if (!devId) {
      const sensorRows = await this.prisma.$queryRaw`
        select device_id as "deviceId" from public.sensors where sensor_id = ${sensorId} limit 1
      `;
      const sensorRow = Array.isArray(sensorRows) && sensorRows.length > 0 ? sensorRows[0] : null;
      devId = sensorRow?.deviceId;
    }
    if (!devId) return false;
    const device = await this.prisma.device.findUnique({
      where: { deviceId: devId },
      select: { ownerId: true }
    });
    if (device && device.ownerId === userId) return true;

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
    // Load sensor and determine ownership via device
    const sensorRow = await this.prisma.sensor.findUnique({
      where: { sensorId },
      select: { 
        deviceId: true,
        emailAlert: true, 
        mobileAlert: true 
      }
    });

    if (!sensorRow) return null;
    const device = await this.prisma.device.findUnique({
      where: { deviceId: sensorRow.deviceId },
      select: { ownerId: true }
    });

    // If user is owner, return sensor preferences
    if (device && device.ownerId === userId) {
      return {
        email_alert: sensorRow.emailAlert || false,
        mobile_alert: sensorRow.mobileAlert || false,
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
    // Check if user owns the sensor via device
    const sensorRow = await this.prisma.sensor.findUnique({
      where: { sensorId },
      select: { deviceId: true }
    });
    if (!sensorRow) throw new Error('Sensor not found');
    const device = await this.prisma.device.findUnique({
      where: { deviceId: sensorRow.deviceId },
      select: { ownerId: true }
    });

    const updateData = {};
    if (preferences.email_alert !== undefined) updateData.emailAlert = preferences.email_alert;
    if (preferences.mobile_alert !== undefined) updateData.mobileAlert = preferences.mobile_alert;

    // If user is owner, update sensor preferences
    if (device && device.ownerId === userId) {
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
