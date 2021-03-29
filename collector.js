require('dotenv').config()
const cheerio = require('cheerio')
const request = require('sync-request')
const fetch = require('sync-fetch')
const telegraf = require('telegraf')
const cron = require('node-cron')
const logger = require('./log4js').log4js//logger
const db = require('./dbconnection')

cron.schedule('* * * * *', async function(){	
	try{
		logger.debug(`run date : ${new Date()}`)
//		// get db loop
		let res = await db.query('SELECT coin.*, bot.name AS bot_name, bot.token, bot.room_id FROM coin, bot')
		let alert = ''
	
		res.forEach(async (d)=>{
			let sql2 = `
				SELECT COUNT(1) AS proposal_cnt
				FROM coin_info 
				WHERE coin_idx=${d.idx} AND type='proposal'
			`
			let res2 = await db.query(sql2)
			let gitTagArr = getTag(d.git_url)
			let proposalArr = getProposal(d.lcd_url)
			let sql3 = `
				SELECT *
				FROM (
			`
				
			gitTagArr.forEach((d2)=>{
				sql3 +=`
					SELECT '${d2}' AS value
					UNION ALL
				`
			})
			sql3 = sql3.slice(0,-14) + ` ) AS a
				WHERE NOT EXISTS (SELECT value FROM coin_info WHERE value = a.value)
			`
			let res3 = await db.query(sql3)
			let instSql = ''
			res3.forEach(async (d3)=>{
				alert += 'new ! gitTag ' + d.git_url + '/releases/tag/'+ d3.value +'\n'
				instSql += `INSERT INTO coin_info(coin_idx, coin_info.type, coin_info.value) VALUES ('${d.idx}', 'git_tag', '${d3.value}');\n`
			})
			
			if(res2[0].proposal_cnt < proposalArr.length){
				proposalArr.forEach(async (d2)=>{
					alert += (alert == '') ? 'new ! proposal '+d.explorer_url + '/proposals/' + d2.split('|')[0]: '\nnew ! proposal ' + d.explorer_url + '/proposals/' + d2.split('|')[0]
					instSql += `INSERT INTO coin_info(coin_idx, coin_info.type, coin_info.value) VALUES ('${d.idx}', 'proposal', '${d2}');`
				})
			}
			
			//query
			if(instSql != ''){
				await db.query(instSql)
				instSql = ''//initialize
			} else{
				await db.query(`UPDATE coin_info SET edit_date = CURRENT_TIMESTAMP() WHERE coin_idx = '${d.idx}'`)
			}
			
			//send msg
			if(alert != ''){
				logger.debug(alert)
				let bot = new telegraf(d.token)
//				bot.telegram.sendMessage(d.room_id, `[${d.name}]\n${alert}`)
//				.catch((err)=>{ //bot error
//					logger.error(err)
//				})
				alert = ''//initialize
			}
		})
	} catch(err){
		logger.error(err)
	}	
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