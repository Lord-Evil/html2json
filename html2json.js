#!/usr/bin/node
const express = require('express');
const bodyParser = require('body-parser');
let request=require("request");
request = request.defaults({headers:{"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36"}});
const jsdom = require("jsdom");
const fs = require("fs");
const zlib = require('zlib');
const jquery = fs.readFileSync("./lib/jquery.min.js", "utf-8");
const purl = require('./lib/purl.js');
const app = express();
const jsonParser = bodyParser.json({ limit:'100MB' ,extended: false });
const iconv=require("iconv-lite");
const fileOptions={
  root:"./public"
};
app.get('/',function(req,res){
  res.sendFile('index.html',fileOptions);
});
app.get('/ext/:file',function(req,res){
  res.sendFile('ext/'+req.params.file,fileOptions);
});
app.post('/request', jsonParser, function (req, res) {
    res.set('Content-Type','application/json');
    var query = req._parsedUrl.path;
    var response = new Object();
    query=purl("http://localhost"+query).data.param.query;
    var data=req.body;
    try{
      request.post({uri:decodeURIComponent(query["url"]),encoding:null},{"json":data},(e,r,b)=>{
        if(e){
          if(e.code=='EAI_AGAIN'&&e.syscall=='getaddrinfo'){
            response.status="error";
            response.message=e.hostname+" could not be resolved!";
            res.end(JSON.stringify(response));
          }
        }else{
          proccessResponse(res,b,r.headers,query["selector"]);
        }
      });
    }catch(er){
      response.status="error";
      response.message=er.toString();
      res.end(JSON.stringify(response));
    }
});
app.get('/request',  function (req, res) {
    res.set('Content-Type','application/json');
    var query = req._parsedUrl.path;
    var response = new Object();
    query=purl("http://localhost"+query).data.param.query;
    try{
      request.get({uri:decodeURIComponent(query["url"]),encoding:null},(e,r,b)=>{
        if(e){
          if(e.code=='EAI_AGAIN'&&e.syscall=='getaddrinfo'){
            response.status="error";
            response.message=e.hostname+" could not be resolved!";
            res.end(JSON.stringify(response));
          }
        }else{
          proccessResponse(res,b,r.headers,query["selector"]);
        }
      });
    }catch(er){
      response.status="error";
      response.message=er.toString();
      res.end(JSON.stringify(response));
    }
});
function proccessResponse(res,html,headers,selector){
  var response = new Object();
  if(headers["content-encoding"] && headers["content-encoding"]=='gzip'){
  	html=zlib.gunzipSync(html);
  }
  if(headers['content-type'].toLowerCase()=='text/html; charset=windows-1251'){
    html=iconv.decode(html,"win1251");
  }else
    html=iconv.decode(html,"utf-8");

  jsdom.env({html:html,src:[jquery],done:(err,window)=>{
    var $=window.$;
    function html2json(selector){
      function parseElement(v){
        var e = new Object();
        e.attr=new Object();
        $.each(v.attributes,(k,a)=>{
          e.attr[a.name]=a.value;
        })

        e.tagName=v.tagName;
        if(v.childNodes.length>0){
          e.children=new Array();
          $.each(v.childNodes,(k,el)=>{
            var c=new Object();
            if(el.nodeType==3){
              c.type="text";
              c.value=el.wholeText;
            }else if(el.nodeType==1){
              c.type="block";
              c=parseElement(el);
            }
            e.children.push(c);
          });
        }
        return e;
      }
      var o=new Array();
      $(selector).each((k,v)=>{o.push(parseElement(v));});
      return JSON.parse(JSON.stringify(o));
    }
    try{
      if(selector!=undefined&&selector.length>0){
        response.response=html2json(selector);
      }else{
        response.response={};
        response.response.head=html2json("head");
        response.response.body=html2json("body");
      }
      response.status="success";
    }catch(er){
      response.status="error";
      response.message=er.toString();
    }
    res.end(JSON.stringify(response));
  }});
}
var server = app.listen(1608,"localhost", function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log("HTML2JSON listening at http://%s:%s", host, port)
});
