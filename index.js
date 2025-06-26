#!/usr/bin/env node

const { program } = require("commander");
const axios = require("axios");
const ora = require("ora");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Configuration file path
const configDir = path.join(require("os").homedir(), ".minimado-cli");
const configPath = path.join(configDir, "config.json");

// Helper function to create readline interface
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

// Helper function to prompt user for input
function promptUser(question) {
  return new Promise((resolve) => {
    const rl = createReadlineInterface();
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Load configuration
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
  } catch (error) {
    console.error("Error reading config file:", error.message);
  }
  return {};
}

// Save configuration
function saveConfig(config) {
  try {
    // Create config directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error("Error saving config file:", error.message);
    return false;
  }
}

// Get user ID (from config or prompt user)
async function getUserId() {
  const config = loadConfig();
  
  if (config.userId) {
    return config.userId;
  }
  
  console.log("\n🔧 First time setup required!");
  console.log("You need to configure your Clerk User ID.");
  console.log("You can find this in by going to https://minimado.com and clicking the profile icon on the top right. \n");
  
  const userId = await promptUser("Enter your Clerk User ID: ");
  
  if (!userId) {
    console.error("❌ User ID is required to use this CLI tool.");
    process.exit(1);
  }
  
  // Save the user ID
  config.userId = userId;
  if (saveConfig(config)) {
    console.log("✅ User ID saved successfully!\n");
  } else {
    console.error("❌ Failed to save user ID. You'll need to enter it again next time.\n");
  }
  
  return userId;
}

// Add task function
async function addTask(title) {
  try {
    // Get user ID first (this will prompt if needed)
    const userId = await getUserId();
    
    // Now start the spinner for the actual API call
    const spinner = ora(`Adding task: "${title}"`).start();
    
    const res = await axios.post(
      "https://minimado.com/api/tasks/add",
      {
        title: title,
      },
      {
        headers: {
          "X-Clerk-User-Id": userId,
          "Content-Type": "application/json",
        },
      }
    );

    spinner.succeed("Task added successfully!");
    console.log("Response:", JSON.stringify(res.data, null, 2));
  } catch (error) {
    console.error("❌ Failed to add task");

    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error("Error:", error.response.data);
    } else {
      console.error("Error:", error.message);
    }
  }
}

// Format date for display
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) {
    return "1 day ago";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// Format tags for display
function formatTags(tags) {
  if (!tags || tags.length === 0) {
    return null;
  }
  
  return tags.map(tag => {
    // Handle both string tags and object tags
    if (typeof tag === 'string') {
      return tag;
    } else if (tag.name) {
      return tag.name;
    }
    return 'unknown';
  }).join(', ');
}

program
  .name("mm")
  .description("CLI Tool for Minimado task management")
  .version("1.0.0");

// Configuration command
program
  .command("config")
  .description("Manage configuration")
  .option("--set-user-id <userId>", "set your Clerk User ID")
  .option("--show", "show current configuration")
  .option("--reset", "reset all configuration")
  .action(async (options) => {
    const config = loadConfig();
    
    if (options.setUserId) {
      config.userId = options.setUserId;
      if (saveConfig(config)) {
        console.log("✅ User ID updated successfully!");
      } else {
        console.error("❌ Failed to save configuration.");
      }
    } else if (options.show) {
      console.log("📋 Current configuration:");
      console.log("User ID:", config.userId || "Not set");
      console.log("Config file:", configPath);
    } else if (options.reset) {
      const confirm = await promptUser("Are you sure you want to reset all configuration? (y/N): ");
      if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
        try {
          if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
          }
          console.log("✅ Configuration reset successfully!");
        } catch (error) {
          console.error("❌ Failed to reset configuration:", error.message);
        }
      } else {
        console.log("Configuration reset cancelled.");
      }
    } else {
      console.log("Use --help to see available config options");
    }
  });

// List incomplete tasks command
program
  .command("list")
  .description("List all incomplete tasks")
  .option("-a, --all", "show all tasks (including completed)")
  .action(async (options) => {
    try {
      const userId = await getUserId();
      const spinner = ora("Fetching tasks...").start();
      
      const res = await axios.get(
        "https://minimado.com/api/tasks",
        {
          headers: {
            "X-Clerk-User-Id": userId,
          },
        }
      );

      spinner.stop();
      
      const tasks = res.data;
      
      if (!tasks || tasks.length === 0) {
        console.log("📝 No tasks found!");
        return;
      }
      
      // Filter tasks based on options
      const filteredTasks = options.all 
        ? tasks 
        : tasks.filter(task => !task.completed);
      
      if (filteredTasks.length === 0) {
        console.log("🎉 No incomplete tasks! You're all caught up!");
        return;
      }
      
      console.log(`\n📋 ${options.all ? 'All tasks' : 'Incomplete tasks'} (${filteredTasks.length}):\n`);
      
      filteredTasks.forEach((task, index) => {
        const status = task.completed ? "✅" : "⏳";
        const createdDate = formatDate(task.createdAt);
        const formattedTags = formatTags(task.tags);
        
        console.log(`${index + 1}. ${status} ${task.text}`);
        console.log(`   Created: ${createdDate}`);
        
        if (task.completed && task.completedAt) {
          console.log(`   Completed: ${formatDate(task.completedAt)}`);
        }
        
        if (formattedTags) {
          console.log(`   Tags: ${formattedTags}`);
        }
        
        console.log(); // Empty line for spacing
      });
      
    } catch (error) {
      console.error("❌ Failed to fetch tasks");

      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error("Error:", error.response.data);
      } else {
        console.error("Error:", error.message);
      }
    }
  });

// Default action - add task directly
program
  .argument("[title]", "task title to add")
  .action(async (title) => {
    if (title) {
      await addTask(title);
    } else {
      program.help();
    }
  });

program.parse();