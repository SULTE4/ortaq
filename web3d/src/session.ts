import {useEffect,useState} from 'react';
import {useView} from './store';
import type {Snapshot} from './types';
export const embed=new URLSearchParams(location.search).get('embed');
export const parentOrigins=[`http://${location.hostname}:8081`,`http://${location.hostname}:8082`];
export async function request(path:string,token='',body?:unknown){const response=await fetch('/api'+path,{method:body===undefined?'GET':'POST',headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})});const value=await response.json();if(!response.ok)throw Error(value.error??'Could not connect');return value}
export function useSession(){const[token,setToken]=useState(embed?'':sessionStorage.getItem('ortaq-3d-token')??'');
 useEffect(()=>{if(!embed)return;function receive(e:MessageEvent){if(e.source!==window.parent||!parentOrigins.includes(e.origin))return;try{const v=typeof e.data==='string'?JSON.parse(e.data):e.data;if(v?.type==='ortaq:session'&&typeof v.token==='string')setToken(v.token)}catch{}}window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive)},[]);
 useEffect(()=>{if(!token)return;let stopped=false,pending=false;async function sync(){if(pending)return;pending=true;try{const admin=embed==='admin'&&useView.getState().balances;const data:Snapshot=await request('/scene'+(admin?'?balances=true':''),token);if(!stopped){const current=useView.getState();current.set({snapshot:data,connected:true,...(!current.month&&data.reports.length?{month:data.reports[0].month}:{})})}}catch(e){if(!stopped)useView.getState().set({connected:false});}finally{pending=false}}
 sync();const id=setInterval(sync,3000);return()=>{stopped=true;clearInterval(id)}},[token]);
 return {token,setToken:(v:string)=>{setToken(v);if(!embed)sessionStorage.setItem('ortaq-3d-token',v)}};
}
