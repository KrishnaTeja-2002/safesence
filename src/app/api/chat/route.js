import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { messages } = await request.json();

    // Check if OpenAI API key is configured
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      // Fallback to rule-based responses if no API key
      const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
      const response = getDetailedResponse(lastMessage);
      
      return NextResponse.json({ 
        message: response,
        fallback: true 
      });
    }

    // Use OpenAI API for intelligent responses
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant for Safe Sense, an IoT sensor monitoring system.

**IMPORTANT: Be concise and direct. Answer the specific question asked. Don't give unnecessary information.**

**ABOUT SAFE SENSE:**
Safe Sense monitors temperature and humidity sensors in real-time using ESP32 IoT devices. Users can set alerts, share sensors with teams, and view historical data.

**CORE FEATURES:**

1. **Real-Time Monitoring**
   - Dashboard displays live sensor readings with 15-second auto-refresh
   - Visual bar chart showing all sensor values
   - Color-coded status indicators (Green=OK, Yellow=Warning, Red=Alert, Gray=Offline)
   - KPI cards showing notifications count, total sensors, and team members
   - Filter by sensor type (Temperature/Humidity) or access role (Owner/Admin/Viewer)

2. **Sensor Management**
   - Add ESP32-based temperature and humidity sensors
   - Each sensor has: sensor_id, sensor_name, device_id, device_name
   - Configure min/max thresholds for alerts
   - Set warning_limit (default 5 minutes before notification)
   - Support for both Celsius and Fahrenheit units
   - Sensors can be: Temperature only, Humidity only, or Combined
   - Statuses: unknown, ok, warning, alert, offline

3. **Smart Alert System**
   - Automatic status calculation based on thresholds
   - Email and mobile alerts (configurable per sensor)
   - Warning status: readings approaching thresholds
   - Alert status: readings exceeding min/max limits
   - Offline detection: sensor hasn't reported in X minutes
   - Alert preferences page to enable/disable notifications
   - Real-time notifications for critical events

4. **Team Collaboration**
   - Share sensors with team members via email invitation
   - Three access roles:
     * Owner: Full control, can delete sensors, manage sharing
     * Admin: Configure alerts, view/edit settings, no delete
     * Viewer: Read-only access, view data only
   - Team invitations sent via email with secure tokens
   - Accept/reject invitation workflow
   - View all shared sensors on Teams page

5. **Historical Data**
   - View past sensor readings (24 hours, 7 days, 30 days)
   - Data stored in mqtt_consumer_test_base table
   - Charts showing temperature/humidity trends over time
   - Useful for compliance reporting and pattern analysis
   - Export data for external analysis

6. **User Preferences & Settings**
   - Temperature unit: Fahrenheit (°F) or Celsius (°C)
   - Timezone selection for accurate timestamps
   - Dark mode toggle (persisted across sessions)
   - Show/hide dashboard cards (sensors, users, alerts)
   - Email notification preferences
   - Custom username display

7. **Device Management**
   - Add new ESP32 devices from Devices page
   - Each device has unique device_id and device_name
   - Associate multiple sensors with one device
   - Configure sensor types during setup
   - View device owner information

**DATABASE STRUCTURE:**
- Sensors table: stores sensor configuration and latest readings
- Devices table: stores device information and ownership
- mqtt_consumer_test_base: stores all historical sensor readings
- TeamInvitation: manages sensor sharing and access
- UserPreferences: stores user display and notification settings
- sensor_alert_log: logs all alert notifications sent

**TECHNICAL DETAILS:**
- Built with Next.js 15 and React 19
- PostgreSQL database with Prisma ORM
- ESP32 sensors communicate via MQTT protocol
- Real-time updates every 15 seconds
- JWT-based authentication
- Responsive design with Tailwind CSS
- Dark mode support throughout

**COMMON WORKFLOWS:**

Adding a Sensor:
1. Go to Devices page
2. Click "Add Device" button
3. Enter device_id (from ESP32 hardware)
4. Enter device_name (e.g., "Walk-in Freezer #1")
5. Enter sensor_id (unique identifier)
6. Select sensor_type (temperature/humidity)
7. Set min/max thresholds
8. Configure email/mobile alerts
9. Save - sensor appears on dashboard immediately

Setting Up Alerts:
1. Navigate to Alerts page
2. View all sensors with current thresholds
3. Edit sensor to set min_limit and max_limit
4. Set warning_limit (minutes before alert)
5. Enable email_alert and/or mobile_alert
6. Save preferences
7. System automatically monitors and sends notifications

Sharing with Team:
1. Go to Teams page
2. Select sensor to share
3. Enter team member's email address
4. Choose role (owner/admin/viewer)
5. Click "Send Invite"
6. Team member receives email with invitation link
7. They click accept/reject
8. Access granted immediately upon acceptance

Troubleshooting Offline Sensors:
1. Check Dashboard - look for gray status
2. Verify "Last Updated" timestamp
3. Check ESP32 power supply
4. Verify WiFi connectivity
5. Confirm MQTT broker connection
6. Review device_id matches configuration
7. Check sensor_id is correct in database

**RESPONSE RULES:**
- **Answer the question directly** - don't add extra fluff
- **Be brief** - 2-4 sentences for simple questions
- **Use bullet points** for steps
- **Only elaborate if asked for details**
- If they ask "how to check sensors" → tell them where to look (Dashboard)
- If they ask "is sensor online" → explain green=online, gray=offline
- If they ask "how to add" → give quick steps
- **Don't give long explanations unless needed**

**YOUR TONE:**
Direct, helpful, concise. Answer what they asked, nothing more.`
          },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 400,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error('OpenAI API request failed');
    }

    const data = await openaiResponse.json();
    const aiMessage = data.choices[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';

    return NextResponse.json({ message: aiMessage });
  } catch (error) {
    console.error('Chat API error:', error);
    
    // Fallback to detailed responses on error
    try {
      const { messages } = await request.json();
      const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
      const response = getDetailedResponse(lastMessage);
      
      return NextResponse.json({ 
        message: response,
        fallback: true 
      });
    } catch (fallbackError) {
      return NextResponse.json({ 
        message: "I'm having trouble processing your request. Please try again or contact support.",
        error: true 
      });
    }
  }
}

// Enhanced fallback responses with detailed Safe Sense knowledge
function getDetailedResponse(message) {
  // Check sensor online/offline status
  if ((message.includes('sensor') || message.includes('device')) && 
      (message.includes('online') || message.includes('offline') || message.includes('on') || message.includes('off') || 
       message.includes('status') || message.includes('working') || message.includes('check'))) {
    return `**To check if sensors are online or offline:**

1. Go to your **Dashboard**
2. Look at the sensor status in the chart or table

**Status Indicators:**
- 🟢 **Green** = Sensor is ONLINE and working
- 🔴 **Red** = Sensor is ONLINE but reading is critical
- 🟡 **Yellow** = Sensor is ONLINE with warning
- ⚫ **Gray (Offline)** = Sensor is NOT responding

**How to tell:**
- Check "Last Updated" time in the table
- If last updated within 5 minutes = ONLINE
- If last updated >5 minutes ago = OFFLINE
- Gray status badge = OFFLINE

**Quick Check:**
Dashboard → Look at sensor status badge and "Last Updated" column`;
  }

  // Adding sensors
  if (message.includes('add') && (message.includes('sensor') || message.includes('device'))) {
    return `**Adding a New Sensor to Safe Sense**

Follow these steps:

1. Navigate to **Devices** page from the sidebar
2. Click the **"Add Device"** button (top right)
3. Fill in the required details:

   **Device Information:**
   - **Device ID**: Get this from your ESP32 hardware (e.g., "ESP32-001")
   - **Device Name**: Descriptive name (e.g., "Walk-in Freezer #1")
   
   **Sensor Configuration:**
   - **Sensor ID**: Unique identifier for this sensor
   - **Sensor Name**: Easy-to-remember name (e.g., "Freezer Temp Sensor")
   - **Sensor Type**: Choose Temperature, Humidity, or Both
   - **Unit**: Select Fahrenheit (°F) or Celsius (°C)

4. **Set Alert Thresholds:**
   - **Min Limit**: Minimum acceptable value
   - **Max Limit**: Maximum acceptable value
   - **Warning Time**: Minutes before sending alert (default: 5)

5. **Enable Notifications:**
   - ✅ Email Alert: Get email notifications
   - ✅ Mobile Alert: Get mobile notifications

6. Click **"Save"** or **"Add Device"**

Your sensor will appear on the Dashboard immediately and start showing readings once the ESP32 begins transmitting data!

**Tip**: Make sure your ESP32 is connected to WiFi and configured with the correct sensor_id before adding it to Safe Sense.`;
  }

  // Alert configuration
  if (message.includes('alert') || message.includes('threshold') || message.includes('notification')) {
    return `**Safe Sense Alert System Explained**

**How Alerts Work:**

Safe Sense automatically monitors your sensors and calculates their status:

🟢 **OK (Green)**: Reading is within min/max thresholds
🟡 **Warning (Yellow)**: Reading is approaching thresholds
🔴 **Alert (Red)**: Reading has exceeded min/max limits
⚫ **Offline (Gray)**: Sensor hasn't reported for >5 minutes
⚪ **Unknown**: No thresholds configured yet

**Setting Up Alerts:**

1. Go to **Alerts** page from sidebar
2. Find your sensor in the list
3. Click **"Edit"** or **"Configure"**
4. Set your thresholds:
   - **Min Limit**: e.g., 32°F for freezer
   - **Max Limit**: e.g., 40°F for freezer
   - **Warning Limit**: Time in minutes (default: 5)

5. Enable notifications:
   - ✅ **Email Alert**: Sends to your registered email
   - ✅ **Mobile Alert**: Sends to mobile (if configured)

6. Click **"Save Preferences"**

**Alert Behavior:**
- System checks sensors every 15 seconds
- Alerts trigger only when readings exceed limits
- One notification per "stint" (continuous alert period)
- No spam - you won't get repeated alerts for same issue
- Alert log stored in database for compliance

**Managing Notifications:**
- Dashboard shows notification count in KPI card
- Click notification bell to view details
- Dismiss individual notifications
- All notifications link to specific sensor

**Pro Tips:**
- Set warning_limit to 3-5 minutes for quick response
- For freezers: typically -10°F to 0°F (−23°C to −18°C)
- For fridges: typically 35°F to 40°F (2°C to 4°C)
- For humidity: typically 30% to 50% RH`;
  }

  // Sharing and teams
  if (message.includes('share') || message.includes('team') || message.includes('invite') || message.includes('access')) {
    return `**Sharing Sensors with Your Team**

Safe Sense allows you to collaborate by sharing sensor access with team members.

**Access Roles Explained:**

👑 **Owner**
- Full control over sensor
- Can delete sensor
- Can manage sharing (add/remove members)
- Can configure all settings
- Can view and export data

🛠️ **Admin**
- Can configure alert thresholds
- Can edit sensor settings
- Can view all data
- Cannot delete sensor
- Cannot manage sharing

👀 **Viewer**
- Read-only access
- Can view current readings
- Can view historical data
- Cannot edit anything
- Cannot configure alerts

**How to Share a Sensor:**

1. Go to **Teams** page from sidebar
2. Find the sensor you want to share
3. Click **"Manage Access"** or **"Share"**
4. Enter team member's **email address**
5. Select their **role** (Owner/Admin/Viewer)
6. Click **"Send Invite"**

**The Invitation Process:**

1. Team member receives email invitation
2. Email contains secure token link
3. They click the link
4. Redirected to accept/reject page
5. Click **"Accept"** to gain access
6. Sensor appears in their dashboard immediately!

**Managing Team Access:**

- View all shared sensors on Teams page
- See who has access to each sensor
- Change roles anytime (Owners only)
- Revoke access by removing user
- Track invitation status (pending/accepted/rejected)

**Important Notes:**
- Each sensor can have multiple team members
- Only Owners can delete sensors
- Shared sensors appear with role badge on Dashboard
- Filter by role: Owned / Admin / Viewer
- Team members inherit email/mobile alert settings

**Use Cases:**
- **Restaurant Manager** shares with kitchen staff (Viewer role)
- **Facility Manager** shares with maintenance team (Admin role)
- **Company Owner** shares between locations (Owner role)`;
  }

  // Dashboard and monitoring
  if (message.includes('dashboard') || message.includes('monitor') || message.includes('reading') || message.includes('chart')) {
    return `**Safe Sense Dashboard Guide**

Your Dashboard is the central hub for real-time monitoring.

**Dashboard Components:**

📊 **KPI Cards (Top Section)**

1. **Notifications Card** 🔔
   - Shows count of active alerts
   - Click to view notification popup
   - Red dot indicates unread alerts
   - Dismiss notifications individually

2. **Sensors Card** 📶
   - Total sensor count
   - Breakdown by status:
     • Red = Alert status
     • Yellow = Warning status
     • Green = OK status
     • Gray = Offline/Unknown
     • ✖ = No data received
   - Click to go to Alerts page

3. **Users Card** 👥
   - Count of team members with access
   - Excludes your own account
   - Click to manage team

**Main Chart Area:**

📈 **Visual Bar Chart**
- Live readings for all sensors
- Height of bar = current value
- Color matches status:
  • Green gradient = OK
  • Yellow gradient = Warning
  • Red gradient = Alert (animated pulse)
  • Gray = Offline/Unconfigured
- Hover to see tooltip
- Value label floats above each bar
- Auto-scales based on sensor type

🎛️ **Filters**
- **Type Filter**: All / Temperature / Humidity
- **Role Filter**: All / Owned / Admin / Viewer
- Filters apply to chart AND table

📋 **Sensor Details Table**
Columns:
- **Sensor**: Name + role badge (Owner/Admin/Viewer)
- **Type**: Temperature or Humidity
- **Reading**: Current value with status color
- **Status**: Color-coded badge
- **Last Updated**: Timestamp in your timezone

**Auto-Refresh:**
- Dashboard updates every 15 seconds automatically
- "Last updated" timestamp shows sync time
- No page refresh needed
- Seamless background updates

**Status Color Guide:**
- 🟢 Green = Normal (OK)
- 🟡 Yellow = Warning (approaching limits)
- 🔴 Red = Critical (exceeds limits) - needs attention!
- ⚫ Gray = Offline or Unconfigured

**Tips:**
- Use filters to focus on specific sensors
- Click notification bell frequently
- Watch for pulsing red bars = immediate action needed
- Last Updated time helps diagnose connection issues
- Table scrolls if you have many sensors

**Right-Side Legend:**
Shows temperature zones (Frozen, Ice, Very Cold, Cold, Ideal, Cool, Room, Warm, Hot, Critical) for context.`;
  }

  // History and analytics
  if (message.includes('history') || message.includes('past') || message.includes('trend') || message.includes('data') || message.includes('report')) {
    return `**Viewing Historical Sensor Data**

Safe Sense stores all sensor readings for compliance and analysis.

**Accessing History:**

1. Go to **History** page from sidebar
2. Select a sensor from dropdown menu
3. Choose date range:
   - **24 Hours**: Detailed recent activity
   - **7 Days**: Weekly patterns
   - **30 Days**: Monthly trends
   - **Custom**: Pick specific date range

**What You'll See:**

📈 **Time-Series Charts**
- Line graph showing readings over time
- X-axis: Time (in your timezone)
- Y-axis: Temperature or Humidity value
- Color-coded by status during that time
- Zoom in on specific periods
- Export chart as image

📊 **Statistics**
- Minimum reading
- Maximum reading
- Average value
- Time in each status
- Alert event count

**Data Storage:**

All readings stored in mqtt_consumer_test_base table:
- **Time**: Exact timestamp (UTC)
- **Sensor ID**: Which sensor
- **Reading Value**: Temperature or humidity
- **MQTT Topic**: Source topic
- **Replay Flag**: Indicates backfilled data

**Use Cases:**

🏢 **Compliance Reporting**
- FDA/HACCP temperature logs
- Proof of proper storage conditions
- Export data for audits
- Document cold chain integrity

🔍 **Troubleshooting**
- Identify when sensor went offline
- See temperature fluctuations
- Find patterns before equipment failure
- Correlate with events

📈 **Optimization**
- Analyze cooling cycles
- Identify energy waste
- Optimize set points
- Reduce compressor wear

💰 **Cost Savings**
- Detect equipment issues early
- Prevent food spoilage
- Reduce energy costs
- Avoid compliance fines

**Pro Tips:**
- Check history before filing warranty claims
- Download data before equipment maintenance
- Compare sensors to find outliers
- Use 7-day view to spot weekly patterns
- 30-day view reveals seasonal trends

**Export Options:**
- Download CSV for Excel analysis
- Share with insurance providers
- Include in compliance reports
- Archive for recordkeeping`;
  }

  // Offline sensors
  if (message.includes('offline') || message.includes('not working') || message.includes('disconnect') || message.includes('no data')) {
    return `**Troubleshooting Offline Sensors**

When a sensor shows **Offline** (gray) status, follow these steps:

**Step 1: Verify Power Supply**
✓ Check ESP32 device is plugged in
✓ Look for power LED on ESP32
✓ Try different power adapter if available
✓ Check USB cable connection

**Step 2: Check Network Connectivity**
✓ Verify WiFi is available at device location
✓ Check WiFi credentials are correct in ESP32
✓ Test WiFi signal strength (use phone)
✓ Move device closer to router if needed
✓ Restart router if necessary

**Step 3: Verify ESP32 Configuration**
✓ Confirm sensor_id matches database
✓ Check device_id is correct
✓ Verify MQTT broker settings
✓ Review ESP32 serial monitor logs
✓ Re-flash firmware if corrupted

**Step 4: Check Safe Sense Dashboard**
✓ Note "Last Updated" timestamp
✓ If offline >5 minutes = connection issue
✓ If just added = allow 1-2 minutes for first reading
✓ Check if other sensors are working (rules out server issue)

**Step 5: MQTT Broker**
✓ Verify MQTT broker is running
✓ Check MQTT topic configuration
✓ Ensure ESP32 can reach broker
✓ Review broker logs for connection attempts
✓ Check firewall rules

**Common Issues & Solutions:**

❌ **"No Data" in table**
- Sensor never transmitted since setup
- Check ESP32 code has correct sensor_id
- Verify MQTT publishing code is running

❌ **Gray status after working fine**
- Power interruption or WiFi dropped
- ESP32 rebooted and can't reconnect
- Check for recent network changes

❌ **Intermittent offline**
- Weak WiFi signal
- Power supply fluctuations
- ESP32 overheating
- MQTT connection timeout too short

❌ **Just added, still offline**
- Give it 2-3 minutes
- ESP32 needs to connect to WiFi first
- Then connect to MQTT broker
- Then start publishing data

**Quick Diagnostic:**

1. Check Dashboard "Last Updated":
   - Within last 5 min = Sensor is working
   - 5-30 min ago = Possible connection issue
   - >30 min = Definitely offline

2. Power cycle the ESP32:
   - Unplug for 10 seconds
   - Plug back in
   - Wait 2 minutes
   - Check Dashboard

3. View ESP32 Serial Monitor:
   - Connect via USB
   - Open serial monitor (115200 baud)
   - Look for WiFi connection success
   - Look for MQTT publish confirmation

**Prevention:**
- Use reliable power supplies
- Place ESP32 devices within good WiFi range
- Monitor "Last Updated" regularly
- Set up alert for offline status
- Keep backup sensors for critical locations

**Still Not Working?**
- Contact your system administrator
- Check database for sensor_id
- Verify device_id ownership
- Review MQTT consumer logs
- Check PostgreSQL connectivity`;
  }

  // Settings and preferences
  if (message.includes('setting') || message.includes('preference') || message.includes('account') || message.includes('temperature unit') || message.includes('timezone')) {
    return `**User Settings & Preferences**

Customize your Safe Sense experience in the **Account** page.

**Accessing Settings:**
1. Click your **profile icon** (initials) in top-right corner
2. Select **"Account"** from menu

**Available Settings:**

⚙️ **Display Preferences**

**Temperature Unit**
- **Fahrenheit (°F)**: Default for US
- **Celsius (°C)**: International standard
- Changes ALL temperature displays immediately
- Stored in database user_preferences table

**Timezone**
- Select your local timezone
- Affects "Last Updated" timestamps
- Affects historical data display
- Ensures accurate alert timing
- Default: America/Anchorage

🌙 **Dark Mode**
- Toggle light/dark theme
- Persists across all pages
- Saves automatically
- Easier on eyes in dark environments
- All components adapt (dashboard, charts, tables)

📊 **Dashboard Visibility**

Control what appears on Dashboard:
- ✅ **Show Temperature Sensors**: Display temp readings
- ✅ **Show Humidity Sensors**: Display humidity readings
- ✅ **Show Sensors Card**: Show sensor KPI card
- ✅ **Show Users Card**: Show team members count
- ✅ **Show Alerts Card**: Show notifications card

📧 **Notification Preferences**

- **Email Notifications**: Receive alerts via email
- **Show Notifications**: Display notification card
- Configure per-sensor in Alerts page

👤 **Profile Settings**

- **Username**: Custom display name
  - Shown in Dashboard greeting
  - Defaults to email prefix
  - Can be changed anytime

- **Email**: Your registered email address
  - Cannot be changed (contact admin)
  - Used for authentication
  - Receives all alerts and invitations

🔒 **Security** (Future)

- Change password
- Two-factor authentication
- Session management
- Login history

**How Settings are Stored:**

All preferences saved in user_preferences table:
- user_id: Links to your account
- temp_scale: F or C
- time_zone: IANA timezone string
- dark_mode: true/false
- show_temp, show_humidity: visibility toggles
- show_sensors, show_users, show_alerts: card visibility

**Changes Take Effect:**
- Immediately after saving
- No page refresh needed
- Persists across devices
- Synced to your account

**Best Practices:**
- Set timezone to your location for accurate timestamps
- Choose temp unit matching your region/industry
- Use dark mode in low-light environments
- Hide cards you don't need for cleaner dashboard
- Enable all notifications for critical sensors

**Keyboard Shortcuts:**
- Ctrl/Cmd + D: Toggle dark mode (if implemented)
- Ctrl/Cmd + , : Open settings (if implemented)`;
  }

  // Status meanings
  if (message.includes('status') || message.includes('color') || message.includes('mean') || message.includes('green') || message.includes('red') || message.includes('yellow')) {
    return `**Understanding Sensor Statuses**

Safe Sense uses 5 statuses to indicate sensor health:

🟢 **OK (Green)**
- Reading is within configured min/max thresholds
- Everything is normal
- No action required
- Example: 36°F when threshold is 32-40°F

🟡 **WARNING (Yellow)**
- Reading is approaching thresholds
- Not critical yet, but worth monitoring
- Prepare for potential issue
- Example: 42°F when max is 45°F (getting close!)

🔴 **ALERT (Red)** ⚠️
- Reading has EXCEEDED min or max threshold
- **IMMEDIATE ACTION REQUIRED**
- Email/mobile notifications sent
- Bar chart shows pulsing animation
- Example: 50°F when max is 40°F (too hot!)

⚫ **OFFLINE (Gray)**
- Sensor hasn't reported data in >5 minutes
- Connection issue or power problem
- Check ESP32 device immediately
- Could indicate equipment failure
- Shows "NA" for reading value

⚪ **UNKNOWN (Gray)**
- No thresholds configured yet
- Fresh sensor without min/max limits set
- Go to Alerts page to configure
- Shows as "Unconfigured" in some views

**Status Calculation Logic:**

The system automatically determines status based on:

1. **Latest Reading**: Most recent sensor value
2. **Min Limit**: Configured minimum threshold
3. **Max Limit**: Configured maximum threshold
4. **Last Update Time**: When sensor last reported
5. **Warning Limit**: Grace period in minutes

**Formulas:**
\`\`\`
IF reading < min_limit OR reading > max_limit:
  status = ALERT

ELSE IF approaching thresholds (within 10%):
  status = WARNING

ELSE IF last_update > 5 minutes ago:
  status = OFFLINE

ELSE IF no thresholds configured:
  status = UNKNOWN

ELSE:
  status = OK
\`\`\`

**Where Status is Shown:**

1. **Dashboard Chart**: Color of bar
2. **Dashboard Table**: Status badge column
3. **Alerts Page**: Status for each sensor
4. **History Page**: Status during historical periods
5. **KPI Card**: Count breakdown by status

**Status Persistence:**

- Stored in sensors.status field (database)
- Updated every time sensor reports
- Triggers checked automatically
- Alert log created for each status change
- Notifications sent only on transition to ALERT

**Taking Action:**

**Green (OK)** → No action needed ✓

**Yellow (WARNING)** → Monitor closely, prepare intervention

**Red (ALERT)** → Immediate action:
- Check physical location
- Verify equipment running
- Adjust temperature controls
- Contact maintenance if needed

**Gray (OFFLINE)** → Troubleshoot connectivity:
- Check power supply
- Verify WiFi connection
- Restart ESP32 device
- Check MQTT broker

**Gray (UNKNOWN)** → Configure thresholds:
- Go to Alerts page
- Set min and max limits
- Save preferences

**Pro Tips:**
- Don't ignore yellows - they prevent reds!
- Set conservative thresholds for critical sensors
- Monitor "offline" status - could be power outage
- Configure alerts even if you check Dashboard regularly`;
  }

  // Login and authentication
  if (message.includes('login') || message.includes('password') || message.includes('sign in') || message.includes('forgot') || message.includes('reset')) {
    return `**Safe Sense Login & Authentication**

**Logging In:**

1. Go to login page: Your Safe Sense URL + /login
2. Enter your registered **email address**
3. Enter your **password**
4. Click **"Login"** or press Enter
5. You'll be redirected to Dashboard upon success

**First-Time Setup:**

If you're new to Safe Sense:
1. Ask admin to create your account
2. Check email for verification link
3. Click link to verify your email
4. Email verification redirects you to Dashboard
5. Auth token stored in browser (localStorage)

**Forgot Password:**

1. Click **"Forgot Password"** on login page
2. Enter your registered email
3. Check inbox for reset email
4. Click reset link (valid for limited time)
5. Enter new password (twice for confirmation)
6. Password updated immediately
7. Return to login page
8. Log in with new password

**Account Security:**

🔒 **Password Requirements:**
- Minimum 8 characters recommended
- Mix of letters and numbers
- Avoid common passwords
- Don't share with others

🔑 **Authentication Method:**
- JWT (JSON Web Token) based
- Token stored in localStorage
- Token sent with every API request
- Expires after period of inactivity
- Must re-login when expired

📧 **Email Verification:**
- Required for new accounts
- Prevents unauthorized signups
- Ensures valid email for alerts
- Check spam folder if not received

**Common Login Issues:**

❌ **"Invalid credentials"**
- Check email spelling
- Verify caps lock is off
- Try password reset if unsure

❌ **"Email not verified"**
- Check inbox for verification email
- Click verification link
- Check spam/junk folder
- Request new verification email

❌ **"Session expired"**
- Token has expired
- Simply log in again
- Normal behavior after inactivity

❌ **"Account locked"**
- Too many failed login attempts
- Wait 15 minutes and try again
- Contact admin if persists

**Session Management:**

- Session stays active while using app
- Auto-logout after 24 hours of inactivity
- "Remember me" feature (if enabled)
- Can logout manually from Dashboard
- Clear browser data logs you out

**Security Best Practices:**

✓ Use unique password for Safe Sense
✓ Don't share login credentials
✓ Log out when using shared computers
✓ Enable two-factor auth (if available)
✓ Change password periodically
✓ Report suspicious activity to admin

**Multi-Device Access:**

- Can be logged in on multiple devices
- Each gets own session token
- Logout on one doesn't affect others
- Preferences sync across devices
- Dashboard state is independent per device

**Admin Accounts:**

If you're an admin/owner:
- Can create new user accounts
- Can reset user passwords
- Can manage team invitations
- Have access to all sensors you own`;
  }

  // ESP32 and hardware
  if (message.includes('esp32') || message.includes('hardware') || message.includes('device') || message.includes('mqtt') || message.includes('setup')) {
    return `**ESP32 Hardware & MQTT Setup**

Safe Sense uses ESP32 microcontrollers as sensor nodes.

**Hardware Requirements:**

**ESP32 Device:**
- ESP32-WROOM-32 or similar
- WiFi capability (built-in)
- USB connection for programming
- 3.3V or 5V power supply

**Temperature Sensors:**
- DHT11/DHT22 for temp + humidity
- DS18B20 for temperature only
- MCP9808 high-accuracy temp sensor
- BME280 for temp/humidity/pressure

**Connections:**
- Power: 3.3V or 5V (depending on sensor)
- Ground: GND
- Data: GPIO pin (configurable)

**ESP32 Configuration:**

**1. WiFi Setup:**
\`\`\`cpp
const char* ssid = "YourWiFiNetwork";
const char* password = "YourWiFiPassword";
\`\`\`

**2. MQTT Broker:**
\`\`\`cpp
const char* mqtt_server = "your.mqtt.broker.com";
const int mqtt_port = 1883;
const char* mqtt_topic = "safesense/sensors";
\`\`\`

**3. Sensor IDs:**
\`\`\`cpp
const char* device_id = "ESP32-001";
const char* sensor_id = "TEMP-SENSOR-001";
\`\`\`

**4. Reading & Publishing:**
\`\`\`cpp
// Read sensor
float temperature = readTemperature();

// Publish to MQTT
String payload = "{sensor_id:" + sensor_id + ",value:" + temperature + "}";
mqttClient.publish(mqtt_topic, payload);
\`\`\`

**MQTT Protocol:**

Safe Sense uses MQTT for real-time data:

**Topic Structure:**
\`\`\`
safesense/sensors/{sensor_id}
\`\`\`

**Message Format (JSON):**
\`\`\`json
{
  "sensor_id": "TEMP-001",
  "device_id": "ESP32-001",
  "value": 36.5,
  "unit": "F",
  "timestamp": "2025-10-18T12:00:00Z"
}
\`\`\`

**Publishing Frequency:**
- Recommended: Every 15-30 seconds
- Minimum: Every 60 seconds
- Maximum: Every 5 seconds (avoid spam)

**Data Flow:**

\`\`\`
ESP32 Sensor
    ↓
Read Temperature/Humidity
    ↓
Format JSON payload
    ↓
Publish to MQTT Broker
    ↓
MQTT Consumer Service
    ↓
PostgreSQL Database (mqtt_consumer_test_base)
    ↓
Safe Sense API
    ↓
Dashboard Display
\`\`\`

**Troubleshooting ESP32:**

**WiFi Connection Issues:**
- Check SSID and password
- Verify WiFi signal strength
- Use 2.4GHz network (not 5GHz)
- Check router allows ESP32 MAC address

**MQTT Connection Failed:**
- Verify broker URL and port
- Check firewall rules
- Test broker with MQTT.fx tool
- Ensure ESP32 can reach internet

**Sensor Readings Wrong:**
- Calibrate sensor
- Check wiring connections
- Verify voltage levels
- Try different GPIO pin

**Data Not Appearing:**
- Verify sensor_id matches database
- Check MQTT topic configuration
- Review Serial Monitor output
- Confirm broker receiving messages

**Best Practices:**

✓ Use unique sensor_id for each sensor
✓ Include error handling in code
✓ Add watchdog timer for stability
✓ Log errors to Serial Monitor
✓ Test thoroughly before deployment
✓ Use reliable power supply
✓ Secure ESP32 in weatherproof enclosure
✓ Document GPIO pin assignments
✓ Keep firmware updated
✓ Monitor battery levels (if battery-powered)

**Example Reading Intervals:**

- **Critical Sensors**: Every 15 seconds
- **Normal Monitoring**: Every 30 seconds
- **Energy Saving**: Every 60 seconds
- **Long-term Logging**: Every 5 minutes

**Power Consumption:**

- Active WiFi + MQTT: ~160mA
- Deep sleep mode: ~10μA
- Wake, read, publish, sleep: Best for battery
- USB powered: No concern
- Battery: Calculate runtime based on capacity`;
  }

  // Default - try to be helpful based on keywords
  if (message.includes('help') || message.includes('what can you')) {
    return `I can help you with Safe Sense questions:

• How to add sensors
• Check sensor status (online/offline)
• Set up alerts
• Share with team members
• View history
• Change settings
• Troubleshoot issues

Ask me a specific question!`;
  }

  // If no match, give helpful short response
  return `I can help with that! Could you be more specific? 

Try asking:
• "How do I check if sensors are online?"
• "How do I add a sensor?"
• "How do I set up alerts?"
• "How do I share sensors?"

What do you need help with?`;
}
