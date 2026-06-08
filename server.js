require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const QRCode = require('qrcode');
const Groq = require('groq-sdk');

const app = express();
const PORT = process.env.PORT || 3000;
const localUrl = process.env.SITE_URL || `http://localhost:${PORT}`;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Upload dir
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `avatar-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'llama-3.3-70b-versatile';
const FAST_MODEL = 'llama-3.1-8b-instant';

// ── QR Code endpoint ────────────────────────────────────────────────────────
app.get('/api/qr', async (req, res) => {
  try {
    const url = localUrl;
    const qr = await QRCode.toDataURL(url, {
      width: 200,
      margin: 2,
      color: { dark: '#3d2c1e', light: '#fdf6ec' },
    });
    res.json({ qr, url, port: PORT });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Avatar upload ───────────────────────────────────────────────────────────
app.post('/api/upload-avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}`, filename: req.file.filename });
});

// ── AI Chat (streaming) ─────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, history = [], userProfile = {} } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const { niche = 'lifestyle', style = 'Gen Z', goals = 'grow followers', name = 'Creator' } = userProfile;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const systemPrompt = `You are a hyper-creative AI content bestie and social media strategist for ${name}. 
They create ${niche} content in a ${style} style. Their main goal: ${goals}.
Be fun, energetic, Gen Z coded, use emojis naturally, give specific actionable advice.
You help with: content ideas, viral hooks, captions, trending sounds, video scripts, hashtags, posting schedules, brand deals, thumbnails, and engagement growth.
Keep responses punchy, exciting, and tailored to their niche. Max 3-4 sentences unless they ask for something detailed.`;

    const messages = [
      ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    const stream = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 500,
      stream: true,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else { res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`); res.end(); }
  }
});

// ── Content Generator ───────────────────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  const { type, topic, niche, style, tone } = req.body;

  const prompts = {
    hook:     `Write 5 ultra-viral hooks for a ${niche} ${style} video about "${topic}". Each hook should stop scrolling instantly. Format: numbered list, one per line.`,
    caption:  `Write 3 Instagram/TikTok captions for ${niche} content about "${topic}" in a ${tone || style} tone. Include relevant emojis and call-to-action. Format: numbered, separated by ---`,
    script:   `Write a 30-60 second video script for a ${niche} ${style} video about "${topic}". Include: hook (first 3 seconds), main content, CTA. Format clearly with labels.`,
    hashtags: `Generate 20 strategic hashtags for ${niche} content about "${topic}" — mix of large, medium, and niche-specific tags. Group them by size.`,
    ideas:    `Give 8 viral content ideas for a ${niche} creator with ${style} aesthetic. Include format (reel/carousel/short), hook angle, and why it'll perform. Be specific and creative.`,
    schedule: `Create a 7-day content posting schedule for a ${niche} creator aiming to ${tone || 'grow followers'}. Include: day, time, platform, content type, and topic idea.`,
  };

  if (!prompts[type]) return res.status(400).json({ error: 'Invalid type' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await groq.chat.completions.create({
      model: MODEL, max_tokens: 800, stream: true,
      messages: [
        { role: 'system', content: 'You are an expert social media strategist and viral content creator. Be specific, creative, and actionable.' },
        { role: 'user', content: prompts[type] },
      ],
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else { res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`); res.end(); }
  }
});

// ── Trend Analysis ──────────────────────────────────────────────────────────
app.post('/api/trends', async (req, res) => {
  const { niche } = req.body;
  try {
    const response = await groq.chat.completions.create({
      model: FAST_MODEL, max_tokens: 600,
      messages: [
        { role: 'system', content: 'You are a real-time social media trend analyst. Return JSON only, no markdown.' },
        { role: 'user', content: `Generate 6 current trending content opportunities for ${niche || 'lifestyle'} creators on TikTok/Reels/Shorts. Return as JSON array with fields: title, platform, heat (1-100), type (audio/challenge/format/topic), emoji, description (1 sentence). Return ONLY the JSON array.` },
      ],
    });
    const raw = response.choices[0].message.content.trim();
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const trends = JSON.parse(cleaned);
    res.json({ trends });
  } catch (err) {
    res.json({ trends: generateFallbackTrends(niche) });
  }
});

function generateFallbackTrends(niche = 'lifestyle') {
  return [
    { title: 'POV: Day in my life', platform: 'TikTok', heat: 94, type: 'format', emoji: '🎬', description: 'First-person perspective daily vlogs are dominating feeds right now.' },
    { title: 'Silent vlog aesthetic', platform: 'Reels', heat: 88, type: 'format', emoji: '🤫', description: 'No talking, just vibes — ASMR-style content with ambient sounds.' },
    { title: 'Get ready with me', platform: 'TikTok', heat: 91, type: 'format', emoji: '✨', description: 'GRWM continues to be evergreen with a personal touch.' },
    { title: 'Expectation vs Reality', platform: 'Shorts', heat: 79, type: 'format', emoji: '🎭', description: 'Relatable contrast content gets massive engagement.' },
    { title: 'Aesthetic morning routine', platform: 'Reels', heat: 85, type: 'topic', emoji: '☀️', description: 'Slow, cinematic morning routines perform extremely well in the AM.' },
    { title: 'Chaotic storytime', platform: 'TikTok', heat: 97, type: 'topic', emoji: '🔥', description: 'Over-the-top storytimes with dramatic hooks keep people watching.' },
  ];
}

// ── Avatar Analysis (Vision) ─────────────────────────────────────────────────
app.post('/api/analyze-avatar', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo' });
  try {
    const imgBuffer = fs.readFileSync(req.file.path);
    const b64 = imgBuffer.toString('base64');
    const ext = path.extname(req.file.originalname).slice(1).toLowerCase();
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;

    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}` } },
          { type: 'text', text: `Analyze this photo. Return ONLY JSON with these exact fields:
skinTone: one of ["pale","light","medium","tan","deep","rich"]
hairColor: a CSS hex color matching the person's hair (e.g. "#3d1a00" for dark brown)
hairLength: one of ["short","medium","long"]
hairStyle: one of ["straight","wavy","curly","buns","ponytail","braids","bob","waves"]
hasGlasses: boolean
makeupStyle: one of ["none","soft","glam","kbeauty"]
vibe: one of ["casual","streetwear","elegant","y2k","indie","cozy"]
eyeColor: a CSS hex color for the eye iris
Return ONLY the JSON object, no markdown, no explanation.` }
        ]
      }]
    });

    const raw = response.choices[0].message.content.trim();
    const cleaned = raw.replace(/```json|```/g, '').trim();
    res.json({ features: JSON.parse(cleaned) });
  } catch (err) {
    res.json({ features: { skinTone:'medium', hairColor:'#3d2c1e', hairLength:'medium', hairStyle:'straight', hasGlasses:false, makeupStyle:'soft', vibe:'casual', eyeColor:'#3d2c1e' } });
  }
});

// ── Social Media Analyze ────────────────────────────────────────────────────
app.post('/api/social/analyze', async (req, res) => {
  const { platform, username, niche, style } = req.body;
  try {
    const response = await groq.chat.completions.create({
      model: MODEL, max_tokens: 800,
      messages: [
        { role: 'system', content: 'You are a social media analytics expert. Return ONLY valid JSON, no markdown, no explanation.' },
        { role: 'user', content: `Analyze the ${platform} page for @${username} who creates ${niche} content in a ${style} style.
Return ONLY a JSON object with:
score: overall page score 0-100
followers: estimated follower range as string (e.g. "10K-50K")
engagementRate: estimated rate as string (e.g. "3.2%")
postingFreq: posting frequency insight as string
topContentTypes: array of 3 strings (best performing content types for this niche/platform)
contentGaps: array of 3 strings (opportunities they're missing)
bestPostTimes: array of 3 strings (best times to post on this platform for this niche)
hashtagStrategy: string (2 sentence hashtag advice)
growthTip: string (1 specific viral growth tip)
competitorEdge: string (1 thing to do differently from competitors)
audienceInsight: string (who their audience likely is)
contentScore: 0-100 (estimated content quality score)
consistencyScore: 0-100 (estimated consistency score)
viralPotential: 0-100 (viral potential score)` },
      ],
    });
    const raw = response.choices[0].message.content.trim();
    const cleaned = raw.replace(/```json|```/g, '').trim();
    res.json(JSON.parse(cleaned));
  } catch (err) {
    res.json({
      score: 68, followers: '5K-20K', engagementRate: '3.5%',
      postingFreq: 'Posting 3-4 times per week is optimal for this niche',
      topContentTypes: ['Behind-the-scenes content', 'Tutorial/How-to posts', 'Trending audio clips'],
      contentGaps: ['Long-form storytelling content', 'Collaboration posts with peers', 'Educational carousel posts'],
      bestPostTimes: ['Tue & Thu 6–8 PM', 'Sat 10 AM–12 PM', 'Sun 7–9 PM'],
      hashtagStrategy: 'Mix 5 large hashtags (1M+) with 10 niche-specific tags under 500K for best reach. Rotate your hashtag sets weekly to avoid shadowbanning.',
      growthTip: 'Post a "response to comment" video replying to your most engaging comment — this format gets 3x normal reach.',
      competitorEdge: 'Go deeper and more personal than competitors — audiences crave authenticity over polished perfection.',
      audienceInsight: 'Primarily 18-34 year olds interested in self-improvement, creative content, and relatable storytelling.',
      contentScore: 65, consistencyScore: 60, viralPotential: 70,
    });
  }
});

// ── YouTube Real Stats ──────────────────────────────────────────────────────
app.post('/api/social/youtube', async (req, res) => {
  const { channelId, apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'API key required' });

  const isHandle = channelId.startsWith('@') || !channelId.startsWith('UC');
  const handle = channelId.startsWith('@') ? channelId.slice(1) : channelId;

  try {
    let channelData = null;
    let resolvedChannelId = null;

    // Try by handle first
    if (isHandle) {
      try {
        const handleUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`;
        const handleRes = await fetch(handleUrl);
        const handleJson = await handleRes.json();
        if (handleJson.items && handleJson.items.length > 0) {
          channelData = handleJson.items[0];
          resolvedChannelId = channelData.id;
        }
      } catch (_) {}
    }

    // Fall back to ID lookup
    if (!channelData) {
      const idUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${encodeURIComponent(channelId)}&key=${apiKey}`;
      const idRes = await fetch(idUrl);
      const idJson = await idRes.json();
      if (idJson.items && idJson.items.length > 0) {
        channelData = idJson.items[0];
        resolvedChannelId = channelData.id;
      }
    }

    if (!channelData) return res.status(404).json({ error: 'Channel not found. Check the handle/ID and API key.' });

    const ch = channelData;
    const channel = {
      name: ch.snippet.title,
      subscribers: ch.statistics.subscriberCount,
      totalViews: ch.statistics.viewCount,
      videoCount: ch.statistics.videoCount,
      description: ch.snippet.description,
      thumbnail: ch.snippet.thumbnails?.medium?.url || ch.snippet.thumbnails?.default?.url,
    };

    // Fetch recent videos
    let recentVideos = [];
    try {
      const videosUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${resolvedChannelId}&type=video&order=date&maxResults=6&key=${apiKey}`;
      const videosRes = await fetch(videosUrl);
      const videosJson = await videosRes.json();
      recentVideos = (videosJson.items || []).map(v => ({
        title: v.snippet.title,
        publishedAt: v.snippet.publishedAt,
        thumbnail: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url,
      }));
    } catch (_) {}

    res.json({ channel, recentVideos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Content Audit ────────────────────────────────────────────────────────────
app.post('/api/social/audit', async (req, res) => {
  const { captions, platform, niche } = req.body;
  if (!captions) return res.status(400).json({ error: 'Captions required' });
  try {
    const response = await groq.chat.completions.create({
      model: MODEL, max_tokens: 900,
      messages: [
        { role: 'system', content: 'You are an expert content strategist and copywriter. Return ONLY valid JSON, no markdown.' },
        { role: 'user', content: `Audit these ${platform} captions for a ${niche} creator:

${captions}

Return ONLY a JSON object with:
auditScore: 0-100
issues: array of 3-5 strings (specific problems found)
rewrites: array of 3 objects {original: first 40 chars of the caption, improved: fully rewritten version}
hookStrength: 0-100
cta_score: 0-100
hashtagScore: 0-100
readability: 0-100
topRecommendation: string` },
      ],
    });
    const raw = response.choices[0].message.content.trim();
    const cleaned = raw.replace(/```json|```/g, '').trim();
    res.json(JSON.parse(cleaned));
  } catch (err) {
    res.json({
      auditScore: 58,
      issues: ['Hooks are too generic and don\'t stop the scroll', 'No clear call-to-action in most captions', 'Hashtag usage is inconsistent', 'Captions are too long for mobile readers'],
      rewrites: [
        { original: captions.substring(0, 40) + '...', improved: 'POV: You finally figured out the one thing nobody talks about 👀 Drop a 🔥 if this hits different' },
        { original: 'Check out my new post...', improved: 'I tried this for 7 days and the results surprised even me. Save this for later 📌' },
        { original: 'Follow for more content!', improved: 'If this made you feel seen, follow for more real talk every week 💬' },
      ],
      hookStrength: 45, cta_score: 40, hashtagScore: 62, readability: 70,
      topRecommendation: 'Start every caption with a bold first line that creates curiosity or emotion — your first 2 words determine if anyone reads the rest.',
    });
  }
});

// ── Growth Strategy ─────────────────────────────────────────────────────────
app.post('/api/social/strategy', async (req, res) => {
  const { platform, username, niche, style, goals, followers, bio } = req.body;
  try {
    const response = await groq.chat.completions.create({
      model: MODEL, max_tokens: 1000,
      messages: [
        { role: 'system', content: 'You are an elite social media growth strategist. Return ONLY valid JSON, no markdown.' },
        { role: 'user', content: `Create a 4-week growth action plan for @${username} on ${platform}.
Creator info: ${niche} niche, ${style} style, goals: ${goals || 'grow followers'}.
${followers ? `Current followers: ${followers}.` : ''}
${bio ? `Bio/description: ${bio}.` : ''}

Return ONLY a JSON object with:
summary: string (2-sentence overall strategy)
weeklyPlan: array of 4 objects, each with:
  week: number (1-4)
  theme: string (focus theme for the week)
  actions: array of 3-4 specific daily/weekly action strings
  contentIdea: string (one specific viral content idea for that week)
  milestone: string (what success looks like by end of week)
quickWins: array of 3 strings (things to do TODAY for immediate impact)
profileOptimizations: array of 4 strings (specific bio/profile improvements)
monetizationPath: string (how to start making money with this profile)
collaborationIdeas: array of 3 strings (specific collab strategies for this niche)` },
      ],
    });
    const raw = response.choices[0].message.content.trim();
    const cleaned = raw.replace(/```json|```/g, '').trim();
    res.json(JSON.parse(cleaned));
  } catch (err) {
    res.json({
      summary: `Your ${platform} growth strategy focuses on consistent, niche-specific content that builds a loyal community over 4 weeks.`,
      weeklyPlan: [
        { week: 1, theme: 'Foundation & Visibility', actions: ['Post 5x this week to signal activity to the algorithm', 'Engage with 20 accounts in your niche daily', 'Optimize your bio with keywords', 'Pin your best performing content'], contentIdea: 'Create a "Why I started" origin story video', milestone: '10% increase in profile visits' },
        { week: 2, theme: 'Viral Content Push', actions: ['Jump on 2 trending sounds/formats', 'Post one controversial opinion in your niche', 'Reply to every comment within 1 hour', 'Collaborate with one peer creator'], contentIdea: 'Film a "Day in my life" following a trending format', milestone: 'First post hitting 2x your average views' },
        { week: 3, theme: 'Community Building', actions: ['Go live once this week', 'Create a poll/question sticker post', 'Reshare a follower\'s content', 'Start a mini series (Part 1 of 3)'], contentIdea: 'Ask followers to vote on your next video topic', milestone: '25% increase in comments vs week 1' },
        { week: 4, theme: 'Scale & Monetize', actions: ['Reach out to 3 brands in your niche', 'Create a lead magnet or freebie', 'Cross-promote on a second platform', 'Analyze your top 3 posts and double down'], contentIdea: 'Create a value-packed carousel or tutorial series', milestone: 'First brand inquiry or affiliate sale' },
      ],
      quickWins: ['Pin your highest-performing post to the top of your profile', 'Add a clear call-to-action to your bio link', 'Comment (not just like) on 10 posts from creators with 10x your following'],
      profileOptimizations: ['Add your niche keyword in your display name', 'Include a specific CTA in your bio (e.g., "New videos every Tue/Thu")', 'Use a high-contrast, recognizable profile photo', 'Add location if relevant to your niche'],
      monetizationPath: 'Start with affiliate marketing for products you already use — share honest reviews and use unique discount codes. Once at 5K+ followers, pitch micro-brand deals with a simple rate card.',
      collaborationIdeas: ['Partner with a creator in a complementary niche for a collab series', 'Join or create a creator accountability group for cross-promotion', 'Participate in niche-specific challenges and tag 3 peers'],
    });
  }
});

// ── Competitor Analysis ──────────────────────────────────────────────────────
app.post('/api/social/competitor', async (req, res) => {
  const { platform, competitorHandle, userHandle, niche, style } = req.body;
  if (!competitorHandle) return res.status(400).json({ error: 'Competitor handle required' });
  try {
    const response = await groq.chat.completions.create({
      model: MODEL, max_tokens: 900,
      messages: [
        { role: 'system', content: 'You are a competitive intelligence analyst for social media creators. Return ONLY valid JSON, no markdown.' },
        { role: 'user', content: `Analyze @${competitorHandle} on ${platform} as a competitor for @${userHandle || 'a creator'} in the ${niche || 'lifestyle'} space.

Return ONLY a JSON object with:
competitorScore: 0-100
estimatedFollowers: string (e.g. "50K-200K")
estimatedEngagement: string (e.g. "4.2%")
strengths: array of 4 strings (what they do well)
weaknesses: array of 3 strings (gaps or weaknesses to exploit)
contentStrategy: string (2-sentence description of their apparent content strategy)
postingFrequency: string (estimated posting cadence)
topFormats: array of 3 strings (their best performing content formats)
opportunitiesToBeat: array of 4 strings (specific ways ${userHandle || 'you'} can outperform them)
differentiation: string (one powerful way to differentiate yourself from this competitor)
stealableIdeas: array of 3 strings (content ideas inspired by their success that you can do better)
threatLevel: one of ["low","medium","high"] (how much of a competitor they are)` },
      ],
    });
    const raw = response.choices[0].message.content.trim();
    const cleaned = raw.replace(/```json|```/g, '').trim();
    res.json(JSON.parse(cleaned));
  } catch (err) {
    res.json({
      competitorScore: 74,
      estimatedFollowers: '20K-80K',
      estimatedEngagement: '3.8%',
      strengths: ['Consistent posting schedule (daily)', 'Strong hook game in first 3 seconds', 'Great use of trending audio', 'Highly engaged comment section'],
      weaknesses: ['Shallow depth — doesn\'t go beyond surface content', 'Lacks a unique POV or signature format', 'Inconsistent visual branding'],
      contentStrategy: 'They focus on high-volume, trend-reactive content that captures short-term attention. Their strategy prioritizes reach over community depth.',
      postingFrequency: 'Daily (7x per week)',
      topFormats: ['POV-style talking head videos', 'Trending audio lip-syncs with text overlay', 'Quick tutorial/hack format'],
      opportunitiesToBeat: ['Go deeper and more educational where they stay surface-level', 'Build a signature series they don\'t have', 'Focus on community/comments which they underutilize', 'Invest in better video quality and transitions'],
      differentiation: 'Lead with your authentic story and specific expertise — while they go broad for reach, you can own a hyper-specific niche angle that builds a more loyal, engaged audience.',
      stealableIdeas: ['Adapt their top-performing format to your specific niche', 'Do a "response to" style video addressing their most popular topic', 'Create a better version of their tutorial content with more depth'],
      threatLevel: 'medium',
    });
  }
});

// ── Post Viral Predictor ─────────────────────────────────────────────────────
app.post('/api/social/predict', async (req, res) => {
  const { idea, platform, niche, style, hook } = req.body;
  if (!idea) return res.status(400).json({ error: 'Post idea required' });
  try {
    const response = await groq.chat.completions.create({
      model: MODEL, max_tokens: 700,
      messages: [
        { role: 'system', content: 'You are a viral content prediction expert. Return ONLY valid JSON, no markdown.' },
        { role: 'user', content: `Predict the viral potential for this ${platform} post idea from a ${niche} creator with ${style} style:

Idea: "${idea}"
${hook ? `Hook: "${hook}"` : ''}

Return ONLY a JSON object with:
viralScore: 0-100
trendAlignment: 0-100
hookStrength: 0-100
audienceAppeal: 0-100
shareability: 0-100
verdict: one of ["🔥 High potential","⚡ Strong","✅ Solid","⚠️ Needs work","❌ Low potential"]
verdictReason: string (1 sentence why)
improvedHook: string (a better, more viral hook for this idea)
bestFormat: string (the optimal format: Reel/TikTok/Short/Carousel/Story etc)
bestTime: string (best day and time to post this specific content)
captionTip: string (specific caption advice for this post)
hashtagSuggestions: array of 8 hashtags for this specific post
risks: string (one thing that could hold this back)
potentialReach: string (estimated reach range e.g. "5K-50K views")` },
      ],
    });
    const raw = response.choices[0].message.content.trim();
    const cleaned = raw.replace(/```json|```/g, '').trim();
    res.json(JSON.parse(cleaned));
  } catch (err) {
    res.json({
      viralScore: 68, trendAlignment: 72, hookStrength: 60, audienceAppeal: 74, shareability: 65,
      verdict: '✅ Solid',
      verdictReason: 'This idea has good audience appeal but needs a stronger hook to compete for attention.',
      improvedHook: 'Nobody talks about this but it changed everything for me 👇',
      bestFormat: 'Short-form video (Reel/TikTok) 30-45 seconds',
      bestTime: 'Tuesday or Thursday, 6–8 PM local time',
      captionTip: 'Start with a bold statement that creates curiosity, follow with 2-3 lines of value, end with a question CTA.',
      hashtagSuggestions: ['#contentcreator', '#creatortips', '#viralvideo', '#socialmediatips', '#growyouraudience', '#creatoreconomy', '#contentmarketing', '#viral'],
      risks: 'Without a strong opening 3 seconds, watch-through rate may drop before the value is delivered.',
      potentialReach: '2K–20K views',
    });
  }
});

// ── Health ──────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', groq: !!process.env.GROQ_API_KEY, port: PORT });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✶ Creator Studio running!`);
  console.log(`   Local:   ${localUrl}`);
  console.log(`   QR:      ${localUrl}/api/qr\n`);
});
