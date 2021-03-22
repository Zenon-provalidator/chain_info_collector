require('dotenv').config()
const cheerio = require('cheerio')
const request = require('sync-request')
const fetch = require('sync-fetch')
const db = require('./dbconnection').mysql
const telegraf = require('telegraf')
const cron = require('node-cron')
const logger = require('./log4js').log4js//logger
const bot = new telegraf(process.env.BOT_TOKEN)

//second minute hour day-of-month month day-of-week
cron.schedule('* * * * *', function(){
	logger.debug(`run date : ${new Date()}`)
	// get db coin loop
	let res = db.query('SELECT * FROM coin')
	let alert = ''

	res.forEach((d)=>{
		let sql2 = `
			SELECT *
			FROM (
				SELECT COUNT(1) AS git_tag_cnt
				FROM coin_info 
			    WHERE coin_idx=${d.idx} AND type='git_tag'
			) AS a,
			(	SELECT COUNT(1) AS proposal_cnt
				FROM coin_info 
			    WHERE coin_idx=${d.idx} AND type='proposal'
			) AS b
		`
		let res2 = db.query(sql2)
		let gitTagArr = getTag(d.git_url)
		let proposalArr = getProposal(d.lcd_url)
		
		if(res2[0].git_tag_cnt < gitTagArr.length){
			gitTagArr.forEach((d2)=>{
				db.query(`INSERT INTO coin_info(coin_idx, type, value) VALUES ('${d.idx}', 'git_tag', '${d2}') ON DUPLICATE KEY UPDATE value='${d2}', edit_date = CURRENT_TIMESTAMP()`)
			})
			alert += 'new ! gitTag ' + d.git_url
		}
		
		if(res2[0].proposal_cnt < proposalArr.length){
			proposalArr.forEach((d2)=>{
				db.query(`INSERT INTO coin_info(coin_idx, type, value) VALUES ('${d.idx}', 'proposal', '${d2}') ON DUPLICATE KEY UPDATE value='${d2}', edit_date = CURRENT_TIMESTAMP()`)
			})
			db.dispose()//db connection close
			alert += (alert == '') ? 'new ! proposal '+d.explorer_url : '\nnew ! proposal ' + d.explorer_url
		} else{//edit date
			db.query(`UPDATE coin_info SET edit_date = CURRENT_TIMESTAMP() WHERE coin_idx = '${d.idx}'`)
			db.dispose()//db connection close
		}
		if(alert != ''){
			//telegram.sendMessage(chatId, text, [extra]) => Promise
			bot.telegram.sendMessage(process.env.BOT_ROOM, `[${d.name}]\n${alert}`)
			alert = ''
		}
	})
}).start()




//get git tag
function getTag(url){
	let gitTagArr = new Array()
	const res = request('GET', url + '/tags')
	const $ = cheerio.load(res.getBody('utf8'))
	$('.commit-title a').each(function(){
		gitTagArr.push($(this).text().trim())
    })
    return gitTagArr
}

//get proposal
function getProposal(url){
	let proposalArr = new Array()
	let json = fetch(url + '/gov/proposals').json()
	let proposals = json.result
	
	for(var i=0; i<proposals.length; i++){
		proposalArr.push(proposals[i].id + '|' +proposals[i].content.value.title)
	}
	return proposalArr
}