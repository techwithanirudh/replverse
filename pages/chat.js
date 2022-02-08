import { useEffect, useState, useRef } from 'react'
import Head from 'next/head';
import ui from '../styles/ui.module.css';
import io from 'socket.io-client'
import styles from '../styles/pages/chat.module.css'
import DashNav from '../components/dashnav'
import Link from 'next/link'
import DOMPurify from 'isomorphic-dompurify';
import { parse } from 'marked';
import { getData } from '../scripts/json.js';
import { User } from '../scripts/mongo.js'

 

let socket = false;

let channels = {
  "Main Talk": "HEADER",
  "general": "General replverse chat.  Please keep things clean.",
  "oof-topic": "Off-topic chat.  Likewise, keep things sfw.",
  "help": "Live help chat",
  "replverse-feedback": "Have any feedback on replverse?  Post it here!",
  "Programming": "HEADER",
  "programmming": "Programming in general.",
  "web-dev": "Web-development related stuff goes here.",
  "game-dev": "Game Development related stuff goes here.",
  "bots": "Discord bot conversations and such goes here.",
  "ai-and-ml": "AI and Machine Learning.",
  "misc-programming": "Miscalleneous programming discussion.",
  "Languages": "HEADER",
  "python": "Talk about python here",
  "javascript": "Talk about javascript here",
  "ruby": "Talk about ruby here",
  "html-css": "Talk about html/css here",
  "rust": "Talk about rust here",
  "ruby": "Talk about ruby here",
  "golang": "Talk about golang here",
  "swift": "Talk about swift here",
  "other-langs": "Talk about other langs here",
}

function Channel(props){
  return (<div className={styles.channel} onClick={() => props.onClick(props.name)}>#{props.name}{props.messageCount > 0 ? ` (${props.messageCount})` : ""}</div>)
}

function UserRow(props){
  return (<Link href={"/user/" + props.name}><div className={styles.userRow}>
    <img src={props.avatar}/><span>{props.name}</span>  
  </div></Link>);
}

const ScrollView = () => {
  const elementRef = useRef();
  useEffect(() => elementRef.current.scrollIntoView({ behavior: "smooth" }));
  return <div ref={elementRef} />;
};

export default function Chat(props){
  const [channel, changeChannel] = useState("general");
  const [online, setOnline] = useState([]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(props.messages || []);
  const [autoCom, setAutoCom] = useState([]);
  const inputRef = useRef();
  const users = JSON.parse(props.users).map(x => x.name);
  const [modal, togModal] = useState(true);


  const playNotif = () => {
    let audio = new Audio("/notif.mp3")
    audio.play()
  }
  const completeUser = (user) => {
    return users.filter(x => new RegExp(user, "ig").test(x));
  }
  const handleInput = (e) => {
    let enterKey = e.code === "Enter";
    let shiftKey = e.shiftKey;
    if(enterKey){
      e.preventDefault();
      if(shiftKey){
        setInput(input.slice(0, inputRef.current.selectionStart) + "\n" + input.slice(inputRef.current.selectionStart, input.length))
        enterKey = false;
        shiftKey = false;
      }else{
        if(autoCom.length > 0){
          let inputVal = input.split(' ');
          let sliceBefore = inputVal.slice(0, inputVal.length-1);
          setInput([...sliceBefore, `\u200b@${autoCom[0]}\u200b`].join` `)
          setAutoCom([]);
        }else{
          emitChat();
          enterKey = false;
          shiftKey = false;
        }
      }
    }
  }
  const emitChat = () => {
    fetch("/api/message/send", {
      method: "POST",
      body: JSON.stringify({data: {
        username: props.replitName,
        text: input,
        avatar: props.avatar,
        channel,
        id: Math.random().toString(36).slice(2)
      }, pings: detectPing(input)}),
      headers: {
        "Content-Type": "application/json",
        accept: "*/*"
      }
    }).then(r => r.json()).then(data => {
      if(!data.success){
        alert(data.message)
      }
    })
    setInput("");
  }
  const updateInput = (e) => {
    let val = e.target.value;
    let splitVal = val.split(" ");
    let word = splitVal.slice(-1)[0];
    if(word[0] === "@"){
      let name = word.slice(1, word.length);
      setAutoCom(completeUser(name).sort((a,b) => a.localeCompare(b)).slice(0, 10));
    }else{
      setAutoCom([])
    }
    setInput(val);
  }
  const deleteMessage = (id) => {
    let ask = confirm("Are you sure you would like to delete this?");
    if(ask){
      fetch("/api/message/delete", {
        method: "POST",
        body: JSON.stringify({
          id
        }),
        headers: {
          "Content-Type": "application/json",
          accept: "*/*"
        }
      }).then(r => r.json()).then(data => {
        if(!data.success){
          alert(data.message)
        }
      })
    }
  };
  const detectPing = (txt) => {
    let splt = txt.split` `;
    let foundPings = [];
    for(var i = 0; i < splt.length; i++){
      let word = splt[i];
      if(/\u200b\@.+\u200b/.test(word)){
        foundPings.push(word.replace(/[^0-9a-z]/ig,""));
      }
    }
    return foundPings;
  };

  let send = false;
  const sendNotif = (title, text, icon) => {
    if(!send){
      if (!("Notification" in window)) {
        console.warn("Your Browser does not support Chrome Notifications :(")
      }else if (Notification.permission === "granted") {
        // If it's okay let's create a notification
        let notif = new Notification(title, {
          icon: icon,
          body: text
        });
        setTimeout(() => notif.close(), 3000);
      }else if (Notification.permission !== 'denied') {
        Notification.requestPermission((perm) => {
          if (!('permission' in Notification)) {
            Notification.permission = perm;
          }
          if (perm === "granted") {
            let notif = new Notification(title, {
              icon: icon,
              body: text
            });
            setTimeout(() => notif.close(), 3000);
          }
        });
      }else {
        console.warn(`Failed, Notification Permission is ${Notification.permission}`);
      }
      send = true;
      setTimeout(() => send = false, 100);
    }
    playNotif();
  }

  useEffect(() => {
    if(JSON.parse(localStorage.getItem("chatrulesmodal-replverse"))){
      togModal(false);
    }
    if(!socket){
      socket = io("https://replverse-data.ironcladdev.repl.co", {
        extraHeaders: {
          username: props.replitName
        }
      });
    }
    socket.emit("join", {
      username: props.replitName,
      avatar: props.avatar
    })
    socket.on("online", setOnline)
    socket.on("chat", (msg) => {
      if(msg.last){
        if(detectPing(msg.last.text).includes(props.replitName)){
          sendNotif(msg.last.username, msg.last.text, "/logo.png")
        }
      }
      setMessages(msg.data)
    })
  }, [])

  let inputRows = (input.match(/\n/g) ? input.match(/\n/g).length : 1) + 1;
  
  return (<div>
    <Head>
      <title>Chat | Replverse</title>
    </Head>
    <DashNav>
      <div className={styles.bodyCont}>
        <div className={styles.channelList}>
          <div className={styles.channelContainer}>
            {Object.keys(channels).map(x => channels[x] === "HEADER" ? <h4 key={x}>{x}</h4> :<Channel key={x} name={x} onClick={changeChannel} messageCount={messages.filter(y=>y.channel===x).length}/>)}
          </div>
        </div>
        <div className={styles.chatCore}>
          <div className={styles.headerBar}>
            <strong>#{channel}</strong>{" - "}{channels[channel]}
          </div>
          <div className={styles.messageFlexer}>
          <div className={styles.messageBody}>
            <h2 style={{paddingTop: 20}}>Welcome to #{channel}</h2>
            <p style={{margin: 0, marginBottom: 20}}>{channels[channel]}</p>
            <hr/>
            {messages.filter(x => x.channel === channel).map(x => {
              let san = DOMPurify.sanitize(parse(x.text.replace(/\n/g,"<br>")));
              return (<div style={{
                background: detectPing(x.text).includes(props.replitName) ? "var(--accent-primary-dimmest)" : 'var(--background-root)'
              }} className={styles.message} id={x.id} key={Math.random()}>
                        <img className={styles.messageAvatar} src={x.avatar}/>
                        <div className={styles.mBody}>
                        <div className={styles.mNick}>{x.username} {(x.username === props.replitName || props.admin) && <span className={styles.mDel} onClick={() => deleteMessage(x.id)}>Delete</span>}</div>
                        <div className={styles.mdMessage} dangerouslySetInnerHTML={{__html: san}}></div>
                        </div>
                      </div>)
            })}
              <ScrollView/>
          </div>
              </div>

          <div className={styles.sendForm}>
            <textarea ref={inputRef} maxLength={500} placeholder={"Message #" + channel} className={ui.input} onChange={updateInput} onKeyDown={handleInput} rows={inputRows < 2 ? 2 : (inputRows < 10 ? inputRows : 10)} value={input}/>
            <button className={ui.actionButton} onClick={emitChat}>Send</button>
          </div>
          <div className={styles.userFind} style={{ display: autoCom.length > 0 ? "block" : "none" }}>
            {autoCom.map(x => <div onClick={() => {
              let inputVal = input.split(' ');
              let sliceBefore = inputVal.slice(0, inputVal.length-1);
              setInput([...sliceBefore, `@${x}`].join` `)
              setAutoCom([]);
            }} className={styles.userRes} key={x}>{x}</div>)}
          </div>
        </div>
        <div className={styles.memberList}>
          <h4>Online - {online.length}</h4>
          {online.map(x => <UserRow key={Math.random()} name={x.username} avatar={x.avatar}/>)}
        </div>
      </div>
      <div className={styles.chatRulesModal} style={{display: modal ? "block" : "none"}}>
        <h3 style={{paddingTop: 0, textAlign: 'center '}}>Replverse Chat Rules</h3>
              <p><strong>Important - Please read these rules before you connect with your fellow replers.</strong></p>
              <p><strong>1. Be nice</strong> - Please talk in a positive manner and refrain from being rude, cursing, and talking to others in a negative way.</p>
              <p><strong>2. No Botting</strong> - I'm saying it right here for you.  Botting is not allowed whatsoever.  Whether using your own account, an alternate replit account, or tampering with websockets within the browser console, the same rules apply.  If you want, you may fork this project and make bots for your own fork.</p>
              <p>That's it for the rules.  Please abide by them.  Just because something isn't stated here, doesn't mean you don't have to follow it.  Violating the rules can result in a whole bunch of nasty outcomes. 
 Read the <Link href="/rules">Official Community Rules</Link> for more info.  Thank you for joining and using replverse.  Enjoy.</p>
              <button className={ui.uiButton} style={{width: 200, position: 'relative', left: '50%', transform: 'translatex(-50%)'}} onClick={() => {
              localStorage.setItem("chatrulesmodal-replverse", true)
              togModal(false)
              }}>Close</button>
      </div>
    </DashNav>
  </div>)
}

export async function getServerSideProps({req, res}){
  if(req.headers["x-replit-user-name"]){
    let userData = await fetch("https://" + req.headers.host + "/api/user/" + req.headers["x-replit-user-name"]).then(r => r.json());
    let messages = await getData("messages.json", {});
    let users = await User.find({}, "name");
    return {
      props: {
        avatar: userData.icon.url,
        replitName: req.headers["x-replit-user-name"],
        messages,
        users: JSON.stringify(users),
        admin: JSON.parse(process.env.ADMINS).includes(req.headers["x-replit-user-name"])
      }
    }
  }else{
    return {
      redirect: {
        destination: "/signup"
      }
    }
  }
}