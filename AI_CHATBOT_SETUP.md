# AI Chatbot Setup Guide

## Overview

An intelligent AI-powered chatbot has been added to your Safe Sense application! The chatbot can answer questions about sensor monitoring, device management, alerts, sharing, and more.

## Features

✅ **Floating Chat Widget** - Accessible from any page with a beautiful floating button
✅ **Smart Responses** - Powered by OpenAI GPT-4o-mini for intelligent, context-aware answers
✅ **Fallback System** - Works even without OpenAI API key using smart rule-based responses
✅ **Dark Mode Support** - Seamlessly adapts to your app's dark/light theme
✅ **Conversation History** - Maintains chat context for better responses
✅ **Real-time Typing Indicators** - Shows when the AI is thinking
✅ **Mobile Responsive** - Works great on all devices

## What the AI Can Help With

The chatbot is trained to assist with:

- 📊 **Dashboard & Monitoring**: Understanding sensor readings, statuses, and charts
- 🔔 **Alerts & Notifications**: Setting up thresholds and email alerts
- 📱 **Devices & Sensors**: Adding new sensors, troubleshooting offline issues
- 👥 **Teams & Sharing**: Managing access and permissions
- 📈 **History & Analytics**: Viewing trends and past data
- ⚙️ **Settings & Preferences**: Configuring units, timezone, dark mode
- 🆘 **Troubleshooting**: Fixing common issues

## Setup Instructions

### Step 1: Install Dependencies

Run the following command to install the OpenAI package:

\`\`\`bash
npm install
\`\`\`

### Step 2: Get OpenAI API Key (Optional)

If you want to use the advanced AI-powered responses:

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign up or log in to your account
3. Create a new API key
4. Copy the API key (starts with `sk-...`)

### Step 3: Configure Environment Variables

Add your OpenAI API key to your `.env.local` file:

\`\`\`env
# OpenAI API Key for AI Chatbot
OPENAI_API_KEY=sk-your-openai-api-key-here
\`\`\`

**Note**: If you don't add an API key, the chatbot will still work using intelligent fallback responses!

### Step 4: Restart Your Development Server

\`\`\`bash
npm run dev
\`\`\`

## How to Use

1. **Open Chat**: Click the floating chat button in the bottom-right corner of any page
2. **Ask Questions**: Type your question in the input field
3. **Get Answers**: The AI will respond with helpful, context-aware information
4. **Continue Conversation**: Ask follow-up questions - the AI remembers context
5. **Clear Chat**: Click the trash icon to start a fresh conversation
6. **Close Chat**: Click the X button or click outside to minimize

## Example Questions

Try asking:

- "How do I add a new sensor?"
- "What does the red alert status mean?"
- "How can I share a sensor with my team?"
- "Why is my sensor showing offline?"
- "How do I change from Fahrenheit to Celsius?"
- "What's the difference between admin and viewer roles?"
- "How do I set up temperature alerts?"
- "Where can I see historical sensor data?"

## Technical Details

### Files Created

1. **`/src/components/ChatBot.js`** - Main chatbot UI component
2. **`/src/app/api/chat/route.js`** - API endpoint for AI responses
3. **`/src/app/ClientLayoutContent.js`** - Updated to include chatbot
4. **`/package.json`** - Updated with OpenAI dependency

### API Endpoint

- **URL**: `/api/chat`
- **Method**: POST
- **Request Body**: `{ messages: Array<{role: string, content: string}> }`
- **Response**: `{ message: string, fallback?: boolean }`

### How It Works

1. **With OpenAI API Key**: Uses GPT-4o-mini model with custom system prompt about Safe Sense features
2. **Without API Key**: Falls back to smart rule-based responses that cover common questions
3. **Error Handling**: Gracefully falls back to rule-based system if OpenAI API fails

### Models Used

- **Primary**: GPT-4o-mini (fast, cost-effective, intelligent)
- **Temperature**: 0.7 (balanced creativity and accuracy)
- **Max Tokens**: 500 (concise but complete responses)

## Customization

### Update System Prompt

Edit `/src/app/api/chat/route.js` to customize how the AI responds. The system prompt includes information about:

- Safe Sense features and capabilities
- Sensor statuses and their meanings
- Access roles and permissions
- Step-by-step instructions for common tasks

### Modify Fallback Responses

Edit the `getSmartResponse()` function in `/src/app/api/chat/route.js` to add or update fallback responses for specific keywords.

### Styling

The chatbot uses Tailwind CSS and automatically adapts to your dark mode settings. Customize colors in `/src/components/ChatBot.js`.

## Troubleshooting

### Chatbot not appearing?
- Check that `/src/components/ChatBot.js` exists
- Verify `ClientLayoutContent.js` imports and renders `<ChatBot />`
- Clear browser cache and refresh

### API errors?
- Check OpenAI API key is correct in `.env.local`
- Ensure API key has sufficient credits
- Check browser console for error messages
- The chatbot will fall back to rule-based responses if API fails

### Responses not relevant?
- If using OpenAI: The system prompt may need updating
- If using fallback: Add more rules in `getSmartResponse()` function

## Cost Considerations

GPT-4o-mini is very cost-effective:
- ~$0.00015 per chat interaction (500 tokens)
- ~$1 can handle ~6,600 chat messages
- Ideal for production use

For minimal costs, you can use the free fallback system by not setting an API key.

## Support

For questions or issues with the chatbot:
1. Check this documentation
2. Review browser console for errors
3. Contact your development team
4. Check OpenAI status at [status.openai.com](https://status.openai.com)

---

**Enjoy your new AI assistant! 🤖**

