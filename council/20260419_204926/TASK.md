A recent change introduced a bug into this project. There is a problem where it keeps stuck in an updating loop.  If I start locally installed app on this system that runs on version 1.11.1. It will suggest me on startup to update to the newest version 1.11.2 but as soon as I do that and restart it will be back to the previous version again suggesting me to update to the newest one. This will go on forever.

the app is getting releases only via: 
/home/iceman/Documents/projects/Claude/ai.opensubtitles.com/ai-opensubtitles-desktop-client/scripts/release.sh

The problem initially started to appear when LLM agent was issuing git commands without my authorisation.

You need to find the cause of this problem and come up with a solution. 
Don't change anything. Just read the files.