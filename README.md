# GPUBot
- [GPUBot](#gpubot)
- [What is it](#what-is-it)
    - [General idea](#general-idea)
    - [Handled marketplaces](#handled-marketplaces)
    - [Handled GPUs](#handled-gpus)
    - [Prerequisites](#prerequisites)
- [How to](#how-to)
    - [Get](#get)
    - [Use](#use)
    - [Test](#test)
    - [Build](#build)

# What is it

### General idea
A :robot: designed to ease the buy of a GPU. Launch it and forget about it until it opens a Chrome Window, coming with a fresh GPU in a cart! 
It relies on a Discord server in order to monitor the newest available GPUs, sold by some French marketplaces.

### Handled marketplaces
> ✅ Rue du commerce  
✅ CDiscount  
✅ TopAchat  
✅ LDLC  
✅ GrosBill  
✅ Cybertek 

### Handled GPUs
|Model|Price|
|-----|-----|
|3060|/|
|3060ti|439e|
|3070|549e|
|3070ti|649e|
|3080|759e|
|3080ti|1269e|

### Prerequisites
✅ Windows  
✅ Chrome installed within a 'classic' path 
✅ Subscribe to every desired GPUs channel within Bavarnold Discord server

# How to
### Get
Use the latest [latest bin](https://github.com/eskhio/GPUBot/releases/latest/download/bot.exe) or `npm i @eskh/gpubot`

### Use
1. Run it
2. Select which model you're interested in (**Space Key** to select, **Enter Key** to validate selection)  
![pick](/docs/pick.gif)  
3. Provide your Discord login  
![login](/docs/login.gif)  
4. Wait for it!  
![waiting](/docs/waiting.gif) 

#### Test
To check that everything runs fine, you can:
1. Join this test [Discord channel](https://discord.gg/fPukDbZp3t)
2. [Launch the bot](#how-to) & select the 'test' option when asked  
![testserv](/docs/testserv.gif)  
3. Type the message **ping** within #gpubot -> a GPU should be posted and the bot should open a Chrome Window and make everything to buy it!  
4. Relaunch the bot (do not select the 'test' option if you don't want to test anymore)
![ping](/docs/testping.png)  

#### Build
1. Clone
2.  `npm i --save-dev`
3.  `pkg . --target node17-win-x64 --out-path ./build/exe --compress GZip`
