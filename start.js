const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  PermissionsBitField 
} = require('discord.js');
const { writeFile } = require('fs').promises;
const { default: PQueue } = require('p-queue');
const fs = require('fs');
require('dotenv').config();

// ==================== CONFIGURATION ====================
const config = {
  // Server Configuration
  SERVER_ID: process.env.SERVER_ID,
  
  // Verification Configuration
  VERIFICATION_CHANNEL_ID: process.env.VERIFICATION_CHANNEL_ID,
  
  // Role Switching Configuration
  ROLE_SWITCH_CHANNEL_ID: process.env.ROLE_SWITCH_CHANNEL_ID,
  
  // Role IDs
  OCTOFIED_ROLE_ID: process.env.OCTOFIED_ROLE_ID,
  OTC_OCTOFIED_ROLE_ID: process.env.OTC_OCTOFIED_ROLE_ID,
  EXCEPTIONAL_ROLES: process.env.EXCEPTIONAL_ROLES ? process.env.EXCEPTIONAL_ROLES.split(',') : [],
  
  // Data Storage
  DATA_FILE: 'userRoles.json'
};

// ==================== VALIDATION ====================
if (!config.SERVER_ID || !config.OCTOFIED_ROLE_ID || !config.OTC_OCTOFIED_ROLE_ID) {
  console.error('Missing required configuration values. Please check your .env file.');
  process.exit(1);
}

// ==================== DISCORD CLIENT SETUP ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ==================== ROLE SWITCHING DATA ====================
let userRoles = { octonads: {}, octoverse: {} };

// Load existing role data
if (fs.existsSync(config.DATA_FILE)) {
  try {
    userRoles = JSON.parse(fs.readFileSync(config.DATA_FILE, 'utf8'));
    console.log('Role data loaded successfully');
  } catch (error) {
    console.error('Error reading role data:', error);
  }
}

// Save role data to file
async function saveRoles() {
  try {
    await writeFile(config.DATA_FILE, JSON.stringify(userRoles, null, 2));
  } catch (error) {
    console.error('Error saving roles to file:', error);
  }
}

// ==================== VERIFICATION DATA ====================
const activeCaptchas = new Map();

// Generate a random 6-digit CAPTCHA code
function generateCaptcha() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ==================== COOLDOWNS & QUEUE ====================
const cooldowns = new Map();
const queue = new PQueue({ concurrency: 1 });

// ==================== BOT READY EVENT ====================
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);

  const guild = client.guilds.cache.get(config.SERVER_ID);
  if (!guild) {
    console.error('❌ Server not found! Check SERVER_ID in .env');
    return;
  }

  console.log(`🏰 Connected to server: ${guild.name}`);

  // Check bot permissions
  const botMember = guild.members.me;
  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    console.error('❌ Bot lacks Manage Roles permission!');
    return;
  }

  // ==================== SETUP VERIFICATION CHANNEL ====================
  if (config.VERIFICATION_CHANNEL_ID) {
    const verificationChannel = guild.channels.cache.get(config.VERIFICATION_CHANNEL_ID);
    if (verificationChannel) {
      await setupVerificationChannel(verificationChannel);
    } else {
      console.warn('⚠️ Verification channel not found. Skipping verification setup.');
    }
  }

  // ==================== SETUP ROLE SWITCHING CHANNEL ====================
  if (config.ROLE_SWITCH_CHANNEL_ID) {
    const roleSwitchChannel = guild.channels.cache.get(config.ROLE_SWITCH_CHANNEL_ID);
    if (roleSwitchChannel) {
      await setupRoleSwitchChannel(roleSwitchChannel);
    } else {
      console.warn('⚠️ Role switch channel not found. Skipping role switch setup.');
    }
  }

  console.log('✅ Bot is ready and all systems operational!');
});

// ==================== VERIFICATION CHANNEL SETUP ====================
async function setupVerificationChannel(channel) {
  const embed = new EmbedBuilder()
    .setTitle('🔐 Welcome! in Verification')
    .setDescription(
      'To gain full access and participate in our community, please verify yourself by completing a quick CAPTCHA challenge.\n\n' +
      '**Instructions:**\n' +
      '1. Choose the verification project below.\n' +
      '2. A pop-up form will appear with a CAPTCHA code (visible only to you).\n' +
      '3. Enter the code in the form (6 digits, you have 60 seconds).\n' +
      '4. If successful, you\'ll enter the dedicated project instantly!'
    )
    .setColor(0x5865F2)
    .setFooter({
      text: 'Verification powered by OctoLabs',
      iconURL: client.user.avatarURL() || undefined,
    })
    .setTimestamp();

  const octonadsButton = new ButtonBuilder()
    .setCustomId('octonads_verify')
    .setLabel('OCTONADS (THE NFT COLLECTION)')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🖼️');

  const octoverseButton = new ButtonBuilder()
    .setCustomId('octoverse_verify')
    .setLabel('OCTOVERSE (THE OTC MARKETPLACE)')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('💼');

  const row = new ActionRowBuilder().addComponents(octonadsButton, octoverseButton);

  // Clear previous bot messages
  try {
    const messages = await channel.messages.fetch({ limit: 10 });
    const botMessages = messages.filter(msg => msg.author.id === client.user.id);
    await Promise.all(botMessages.map(msg => msg.delete()));
  } catch (error) {
    console.error('Error clearing previous messages:', error);
  }

  await channel.send({ embeds: [embed], components: [row] });
  console.log('✅ Verification embed sent!');
}

// ==================== ROLE SWITCHING CHANNEL SETUP ====================
async function setupRoleSwitchChannel(channel) {
  const embed = new EmbedBuilder()
    .setTitle('Switch Projects')
    .setDescription('Choose a project to switch:\n\n' +
                    '🔹 **OCTONADS (NFT COLLECTION)**\n' +
                    '🔹 **OCTOVERSE (OTC MARKETPLACE)**')
    .setColor('#00BFFF')
    .setThumbnail(client.user.displayAvatarURL())
    .setFooter({ text: 'Click a button to switch Project!', iconURL: client.user.displayAvatarURL() })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('octonads_switch')
        .setLabel('OCTONADS (NFT COLLECTION)')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('octoverse_switch')
        .setLabel('OCTOVERSE (OTC MARKETPLACE)')
        .setStyle(ButtonStyle.Success)
    );

  await channel.send({ embeds: [embed], components: [row] });
  console.log('✅ Role switch embed sent!');
}

// ==================== INTERACTION HANDLER ====================
client.on('interactionCreate', async (interaction) => {
  // Handle button interactions
  if (interaction.isButton()) {
    const { customId } = interaction;

    // Verification buttons
    if (customId === 'octonads_verify' || customId === 'octoverse_verify') {
      await handleVerificationButton(interaction);
    }

    // Role switching buttons
    if (customId === 'octonads_switch' || customId === 'octoverse_switch') {
      await handleRoleSwitchButton(interaction);
    }
  }

  // Handle modal submissions
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('captcha_modal_')) {
      await handleVerificationModal(interaction);
    }
  }
});

// ==================== VERIFICATION BUTTON HANDLER ====================
async function handleVerificationButton(interaction) {
  const { customId, user, guild, member } = interaction;

  const verifyType = customId === 'octonads_verify' ? 'octonads' : 'octoverse';
  const roleId = verifyType === 'octonads' ? config.OCTOFIED_ROLE_ID : config.OTC_OCTOFIED_ROLE_ID;

  const role = guild.roles.cache.get(roleId);
  if (!role) {
    await interaction.reply({ content: '❌ Role not found. Contact an admin.', ephemeral: true });
    return;
  }

  // Already verified?
  if (member.roles.cache.has(role.id)) {
    await interaction.reply({ content: `✅ You already have the ${role.name} role!`, ephemeral: true });
    return;
  }

  // Generate CAPTCHA
  const captchaCode = generateCaptcha();
  activeCaptchas.set(user.id, { code: captchaCode, type: verifyType });

  // Create Modal
  const modal = new ModalBuilder()
    .setCustomId(`captcha_modal_${verifyType}`)
    .setTitle(`${verifyType.toUpperCase()} Verification`);

  const captchaInput = new TextInputBuilder()
    .setCustomId('captcha_input')
    .setLabel(`Enter this CAPTCHA code: ${captchaCode}`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(6)
    .setMaxLength(6)
    .setPlaceholder('e.g., 123456');

  modal.addComponents(new ActionRowBuilder().addComponents(captchaInput));

  await interaction.showModal(modal);

  // Timeout handling (60 seconds)
  setTimeout(async () => {
    if (activeCaptchas.has(user.id)) {
      try {
        await interaction.followUp({ 
          content: '⏰ Time\'s up! Verification failed. Try again by clicking the button.', 
          ephemeral: true 
        });
      } catch (_) {}
      activeCaptchas.delete(user.id);
    }
  }, 60000);
}

// ==================== VERIFICATION MODAL HANDLER ====================
async function handleVerificationModal(interaction) {
  const { user, guild, member } = interaction;

  const storedCaptcha = activeCaptchas.get(user.id);
  if (!storedCaptcha) {
    await interaction.reply({ 
      content: '❌ Verification session expired. Try again by clicking the button.', 
      ephemeral: true 
    });
    return;
  }

  const verifyType = storedCaptcha.type;
  const roleId = verifyType === 'octonads' ? config.OCTOFIED_ROLE_ID : config.OTC_OCTOFIED_ROLE_ID;

  const role = guild.roles.cache.get(roleId);
  if (!role) {
    await interaction.reply({ content: '❌ Role not found. Contact an admin.', ephemeral: true });
    activeCaptchas.delete(user.id);
    return;
  }

  const userInput = interaction.fields.getTextInputValue('captcha_input');
  const responseEmbed = new EmbedBuilder().setColor(0x5865F2);

  if (userInput === storedCaptcha.code) {
    try {
      await member.roles.add(role);
      responseEmbed
        .setDescription(`✅ Verified successfully! You've been granted the ${role.name} role. Welcome! 🎉`)
        .setColor(0x00FF00);
    } catch (error) {
      console.error('Role assignment error:', error);
      responseEmbed
        .setDescription('❌ Failed to assign role. Contact an admin.')
        .setColor(0xFF0000);
    }
  } else {
    responseEmbed
      .setDescription('❌ Incorrect code. Verification failed. Try again by clicking the button.')
      .setColor(0xFF0000);
  }

  await interaction.reply({ embeds: [responseEmbed], ephemeral: true });
  activeCaptchas.delete(user.id);
}

// ==================== ROLE SWITCHING BUTTON HANDLER ====================
async function handleRoleSwitchButton(interaction) {
  await queue.add(async () => {
    const startTime = Date.now();
    console.log(`🔄 Role switch requested by ${interaction.member.user.tag}`);

    // Defer the reply
    try {
      await interaction.deferReply({ ephemeral: true });
      console.log(`⏱️ Deferred reply in ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error(`❌ Failed to defer interaction:`, error);
      if (error.code === 10062) {
        try {
          await interaction.channel.send({
            content: `<@${interaction.member.id}>, an error occurred while processing your request. Please try again.`,
          });
        } catch (followUpError) {
          console.error(`Failed to send follow-up message:`, followUpError);
        }
      }
      return;
    }

    // Check cooldown (30 seconds)
    const userId = interaction.member.id;
    const now = Date.now();
    const cooldownTime = 30 * 1000;
    
    if (cooldowns.has(userId)) {
      const expirationTime = cooldowns.get(userId) + cooldownTime;
      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        await interaction.editReply({ 
          content: `⏰ Please wait ${timeLeft.toFixed(1)} seconds before switching roles again.` 
        });
        return;
      }
    }
    cooldowns.set(userId, now);
    setTimeout(() => cooldowns.delete(userId), cooldownTime);

    // Ensure interaction is in the correct server
    if (interaction.guildId !== config.SERVER_ID) {
      await interaction.editReply({ content: '❌ This bot is only active in the designated server!' });
      return;
    }

    // Check bot permissions
    if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      await interaction.editReply({ content: '❌ Bot lacks Manage Roles permission!' });
      return;
    }

    const member = interaction.member;
    const octofiedRole = interaction.guild.roles.cache.get(config.OCTOFIED_ROLE_ID);
    const otcOctofiedRole = interaction.guild.roles.cache.get(config.OTC_OCTOFIED_ROLE_ID);

    if (!octofiedRole || !otcOctofiedRole) {
      await interaction.editReply({ 
        content: '❌ Roles not found! Please ensure Octofied and OTC Octofied roles exist.' 
      });
      return;
    }

    // Handle OCTONADS switch
    if (interaction.customId === 'octonads_switch') {
      try {
        if (!member.roles.cache.has(config.OTC_OCTOFIED_ROLE_ID)) {
          await interaction.editReply({ 
            content: '❌ You need the OTC Octofied role to switch to OCTONADS!' 
          });
          return;
        }

        // Store current roles (except exceptional roles and OTC Octofied)
        const rolesToSave = member.roles.cache
          .filter((role) => role.id !== config.OTC_OCTOFIED_ROLE_ID && !config.EXCEPTIONAL_ROLES.includes(role.id))
          .map((role) => role.id);

        // Save roles to octoverse data
        userRoles.octoverse[member.id] = rolesToSave;
        await saveRoles();

        // Prepare new roles
        const newRoles = [
          ...member.roles.cache.filter((role) => config.EXCEPTIONAL_ROLES.includes(role.id)).map((role) => role.id),
          config.OCTOFIED_ROLE_ID,
          ...(userRoles.octonads[member.id] || []),
        ];

        // Set all roles in one API call
        await member.roles.set(newRoles);

        // Clear old octonads data
        if (userRoles.octonads[member.id]) {
          delete userRoles.octonads[member.id];
          await saveRoles();
        }

        const embed = new EmbedBuilder()
          .setTitle('✅ Role Switch Successful')
          .setDescription('You have switched to **OCTONADS (NFT COLLECTION)**!\n' +
                          'Your roles have been updated to include the **Octofied** role.')
          .setColor('#1E90FF')
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        
        console.log(`✅ ${member.user.tag} switched to OCTONADS`);
      } catch (error) {
        console.error(`❌ Error handling octonads switch for ${member.user.tag}:`, error);
        await interaction.editReply({ 
          content: '❌ An error occurred while switching roles. Please try again later.' 
        }).catch(() => {});
      }
    }

    // Handle OCTOVERSE switch
    if (interaction.customId === 'octoverse_switch') {
      try {
        if (!member.roles.cache.has(config.OCTOFIED_ROLE_ID)) {
          await interaction.editReply({ 
            content: '❌ You need the Octofied role to switch to OCTOVERSE!' 
          });
          return;
        }

        // Store current roles (except exceptional roles and Octofied)
        const rolesToSave = member.roles.cache
          .filter((role) => role.id !== config.OCTOFIED_ROLE_ID && !config.EXCEPTIONAL_ROLES.includes(role.id))
          .map((role) => role.id);

        // Save roles to octonads data
        userRoles.octonads[member.id] = rolesToSave;
        await saveRoles();

        // Prepare new roles
        const newRoles = [
          ...member.roles.cache.filter((role) => config.EXCEPTIONAL_ROLES.includes(role.id)).map((role) => role.id),
          config.OTC_OCTOFIED_ROLE_ID,
          ...(userRoles.octoverse[member.id] || []),
        ];

        // Set all roles in one API call
        await member.roles.set(newRoles);

        // Clear old octoverse data
        if (userRoles.octoverse[member.id]) {
          delete userRoles.octoverse[member.id];
          await saveRoles();
        }

        const embed = new EmbedBuilder()
          .setTitle('✅ Role Switch Successful')
          .setDescription('You have switched to **OCTOVERSE (OTC MARKETPLACE)**!\n' +
                          'Your roles have been updated to include the **OTC Octofied** role.')
          .setColor('#32CD32')
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        
        console.log(`✅ ${member.user.tag} switched to OCTOVERSE`);
      } catch (error) {
        console.error(`❌ Error handling octoverse switch for ${member.user.tag}:`, error);
        await interaction.editReply({ 
          content: '❌ An error occurred while switching roles. Please try again later.' 
        }).catch(() => {});
      }
    }
  });
}

// ==================== ERROR HANDLING ====================
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// ==================== LOGIN ====================
client.login(process.env.DISCORD_TOKEN);