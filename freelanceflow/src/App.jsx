import { useState, useEffect, useRef } from "react";
import {
  signInWithPopup, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile, sendEmailVerification
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, provider, db } from "./firebase";


// ── Constants ─────────────────────────────────────────────────
const defaultFinance = { income:[], pending:[], expenses:[], plans:[] };
const EXPENSE_CATS = ["Food","Transport","Software","Office","Utilities","Entertainment","Other"];
const INCOME_CATS  = ["Project","Salary","Bonus","Retainer","Other"];
const PLAN_CATS    = ["Equipment","Software","Travel","Education","Marketing","Office","Other"];


const CURRENCIES = [
  { code:"BDT", symbol:"৳",   name:"Bangladeshi Taka"  },
  { code:"USD", symbol:"$",   name:"US Dollar"          },
  { code:"EUR", symbol:"€",   name:"Euro"               },
  { code:"GBP", symbol:"£",   name:"British Pound"      },
  { code:"AUD", symbol:"A$",  name:"Australian Dollar"  },
  { code:"CAD", symbol:"C$",  name:"Canadian Dollar"    },
  { code:"AED", symbol:"د.إ", name:"UAE Dirham"         },
  { code:"JPY", symbol:"¥",   name:"Japanese Yen"       },
  { code:"INR", symbol:"₹",   name:"Indian Rupee"       },
  { code:"SGD", symbol:"S$",  name:"Singapore Dollar"   },
];
const DEFAULT_RATES = { USD:1, BDT:110, EUR:0.92, GBP:0.79, AUD:1.55, CAD:1.36, AED:3.67, JPY:149, INR:83, SGD:1.34 };


const LEVELS = [
  { name:"Prelude",        emoji:"🌱", color:"#6bcb77", minUSD:0       , desc:"Every journey starts here."        },
  { name:"Sterling",       emoji:"⚡", color:"#4d96ff", minUSD:100     , desc:"Momentum is building!"             },
  { name:"Velvet Tier",    emoji:"🪄", color:"#c084fc", minUSD:1000    , desc:"You've found your rhythm."         },
  { name:"Gold Standard",  emoji:"✨", color:"#f0a500", minUSD:5000    , desc:"Consistency is your superpower."   },
  { name:"Platinum Class", emoji:"💎", color:"#94e2cd", minUSD:20000   , desc:"Elite territory unlocked."        },
  { name:"Black Label",    emoji:"🖤", color:"#94a3b8", minUSD:100000  , desc:"Serious money, serious moves."     },
  { name:"Crown Estate",   emoji:"👑", color:"#fbbf24", minUSD:250000  , desc:"Royalty-level earnings."           },
  { name:"Empire Builder", emoji:"🏆", color:"#00e5a0", minUSD:500000  , desc:"You built an empire. Legendary."  },
];


const defaultWorkProfile = {
  workName:"", workEmail:"", workPhone:"", workAddress:"",
  workCity:"", workCountry:"", workZip:"", website:"",
  taxId:"", invoicePrefix:"INV-", invoiceSuffix:"",
  paymentTerms:"Due upon receipt", invoiceNotes:"",
  invoiceCount:0,
};


// ── FA6 Icons ─────────────────────────────────────────────────
const ICONS = {
  wallet:     { vb:"0 0 512 512", d:"M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V192H48c-8.8 0-16-7.2-16-16s7.2-16 16-16H448V96c0-35.3-28.7-64-64-64H64zM448 256v96H400c-26.5 0-48-21.5-48-48s21.5-48 48-48H448z" },
  bars:       { vb:"0 0 448 512", d:"M0 96C0 78.3 14.3 64 32 64H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 128 0 113.7 0 96zM64 256c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H96c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32H160c-17.7 0-32-14.3-32-32s14.3-32 32-32H416c17.7 0 32 14.3 32 32z" },
  at:         { vb:"0 0 512 512", d:"M256 64C150 64 64 150 64 256s86 192 192 192c17.7 0 32 14.3 32 32s-14.3 32-32 32C114.6 512 0 397.4 0 256S114.6 0 256 0S512 114.6 512 256v32c0 53-43 96-96 96c-29.3 0-55.6-13.2-73.2-33.9C320 371.1 289.5 384 256 384c-70.7 0-128-57.3-128-128s57.3-128 128-128c27.9 0 53.7 8.9 74.7 24.1c5.7-5 13.1-8.1 21.3-8.1c17.7 0 32 14.3 32 32v80 32c0 17.7 14.3 32 32 32s32-14.3 32-32V256c0-106-86-192-192-192zm64 192a64 64 0 1 0 -128 0 64 64 0 1 0 128 0z" },
  signout:    { vb:"0 0 512 512", d:"M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z" },
  circleUser: { vb:"0 0 512 512", d:"M399 384.2C376.9 345.8 335.4 320 288 320l-64 0c-47.4 0-88.9 25.8-111 64.2c35.2 39.2 86.2 63.8 143 63.8s107.8-24.7 143-63.8zM0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256zm256 16a72 72 0 1 0 0-144 72 72 0 1 0 0 144z" },
  gear:       { vb:"0 0 512 512", d:"M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z" },
  user:       { vb:"0 0 448 512", d:"M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512l388.6 0c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304l-91.4 0z" },
  coins:      { vb:"0 0 512 512", d:"M512 80c0 18-14.3 34.6-38.4 48c-29.1 16.1-72.5 27.5-122.3 30.9c-3.7-1.8-7.4-3.5-11.3-5C300.6 137.4 248.2 128 192 128c-8.3 0-16.4 .3-24.5 .8L167 115.2C132.5 89.7 128 62.8 128 48c0-18 14.3-34.6 38.4-48C190.4 .1 224 0 256 0c144.6 0 256 34.3 256 80zM128 176c0 18 14.3 34.6 38.4 48c14.8 8.2 33.6 15.1 55 20.1C174.4 250.5 128 266.9 128 288c0 5.8 1.8 11.4 5 16.7V480c0 17.7-14.3 32-32 32S64 497.7 64 480V176c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16zm64 272V368c20.5 5.1 43.4 8 68 8c80.5 0 144-26.3 144-64V176c0-18-14.3-34.6-38.4-48C340.1 110.1 296.5 96 244.4 96c10.2 3.4 20 7.3 29.1 11.7C324.2 127.4 384 153.9 384 176c0 18-14.3 34.6-38.4 48C316.5 240.1 272.9 256 224 256c-13.5 0-26.5-.9-38.8-2.6c-5.4 6.3-8.5 13.8-8.5 21.6c0 18 14.3 34.6 38.4 48c6.9 3.8 14.4 7.2 22.4 10.2V448z" },
  moneyBill:  { vb:"0 0 576 512", d:"M64 64C28.7 64 0 92.7 0 128V384c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V128c0-35.3-28.7-64-64-64H64zm64 320H64V320c35.3 0 64 28.7 64 64zM64 192V128h64c0 35.3-28.7 64-64 64zM448 384c0-35.3 28.7-64 64-64v64H448zm64-192c-35.3 0-64-28.7-64-64h64v64zM288 160a96 96 0 1 1 0 192 96 96 0 1 1 0-192z" },
  cardFill:   { vb:"0 0 576 512", d:"M64 32C28.7 32 0 60.7 0 96v32H576V96c0-35.3-28.7-64-64-64H64zM576 224H0V416c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V224zM112 352h64c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm48-32H224c8.8 0 16 7.2 16 16s-7.2 16-16 16H160c-8.8 0-16-7.2-16-16s7.2-16 16-16z" },
  hourglass:  { vb:"0 0 384 512", d:"M32 0C14.3 0 0 14.3 0 32S14.3 64 32 64V75c0 42.4 16.9 83.1 46.9 113.1L146.7 256 78.9 323.9C48.9 353.9 32 394.6 32 437v11C14.3 448 0 462.3 0 480s14.3 32 32 32H352c17.7 0 32-14.3 32-32s-14.3-32-32-32V437c0-42.4-16.9-83.1-46.9-113.1L237.3 256l67.9-67.9C335.1 158.1 352 117.4 352 75V64c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zM96 75V64H288V75c0 19-5.6 37.4-16 53H112C101.6 112.4 96 94 96 75zm16 309c3.5-5.3 7.6-10.3 12.1-14.9L192 301.3l67.9 67.9c4.5 4.6 8.6 9.6 12.1 14.9H112z" },
  clock:      { vb:"0 0 512 512", d:"M256 0a256 256 0 1 1 0 512A256 256 0 1 1 256 0zM232 120V256c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.5 33.3-6.5s4.5-25.9-6.5-33.3L280 243.2V120c0-13.3-10.7-24-24-24s-24 10.7-24 24z" },
  trendDown:  { vb:"0 0 576 512", d:"M384 352c-17.7 0-32 14.3-32 32s14.3 32 32 32H544c17.7 0 32-14.3 32-32V224c0-17.7-14.3-32-32-32s-32 14.3-32 32v82.7L342.6 137.4c-12.5-12.5-32.8-12.5-45.3 0L192 242.7 54.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0L320 205.3 466.7 352H384z" },
  triangleEx: { vb:"0 0 512 512", d:"M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z" },
  moneyUp:    { vb:"0 0 512 512", d:"M470.7 9.4c3 3.1 5.3 6.6 6.9 10.3s2.4 7.8 2.4 12V160c0 17.7-14.3 32-32 32s-32-14.3-32-32V109.3L310.6 214.6c-11.8 11.8-30.8 12.6-43.5 1.7L176 138.1 84.8 239.4c-11.9 13-32.2 13.9-45.2 2s-13.9-32.2-2-45.2l112-122c12-13.1 32.5-14 45.7-2.1l89.8 76.4L370.7 64H320c-17.7 0-32-14.3-32-32s14.3-32 32-32H448c4.2 0 8.3 .8 12 2.4c3.7 1.5 7.1 3.8 10 6.7l.7 .3zM0 320c0-17.7 14.3-32 32-32H480c17.7 0 32 14.3 32 32V480c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32V320zM64 384v64H256V384H64zm224 0v64H448V384H288z" },
  creditCard: { vb:"0 0 576 512", d:"M512 80c8.8 0 16 7.2 16 16v32H48V96c0-8.8 7.2-16 16-16H512zm16 144V416c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V224H528zM64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zm56 304c-13.3 0-24 10.7-24 24s10.7 24 24 24h48c13.3 0 24-10.7 24-24s-10.7-24-24-24H120zm128 0c-13.3 0-24 10.7-24 24s10.7 24 24 24H360c13.3 0 24-10.7 24-24s-10.7-24-24-24H248z" },
  bullseye:   { vb:"0 0 512 512", d:"M448 256A192 192 0 1 0 64 256a192 192 0 1 0 384 0zM0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256zm256 80a80 80 0 1 0 0-160 80 80 0 1 0 0 160zm0-224a144 144 0 1 1 0 288 144 144 0 1 1 0-288zM224 256a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z" },
  squareCheck:{ vb:"0 0 448 512", d:"M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zM337 209L209 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L303 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z" },
  pen:        { vb:"0 0 512 512", d:"M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z" },
  chartLine:  { vb:"0 0 512 512", d:"M64 64c0-17.7-14.3-32-32-32S0 46.3 0 64V400c0 44.2 35.8 80 80 80H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H80c-8.8 0-16-7.2-16-16V64zm406.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L320 210.7l-57.4-57.4c-12.5-12.5-32.8-12.5-45.3 0l-112 112c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L240 221.3l57.4 57.4c12.5 12.5 32.8 12.5 45.3 0l128-128z" },
  tag:        { vb:"0 0 448 512", d:"M0 80V229.5c0 17 6.7 33.3 18.7 45.3l176 176c25 25 65.5 25 90.5 0L418.7 317.3c25-25 25-65.5 0-90.5l-176-176c-12-12-28.3-18.7-45.3-18.7H48C21.5 32 0 53.5 0 80zm112 32a32 32 0 1 1 0 64 32 32 0 1 1 0-64z" },
  trash:      { vb:"0 0 448 512", d:"M135.2 17.7L128 32 32 32C14.3 32 0 46.3 0 64S14.3 96 32 96l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0-7.2-14.3C307.4 6.8 296.3 0 284.2 0L163.8 0c-12.1 0-23.2 6.8-28.6 17.7zM416 128L32 128 53.2 467c1.6 25.3 22.6 45 47.9 45l245.8 0c25.3 0 46.3-19.7 47.9-45L416 128z" },
  invoice:    { vb:"0 0 384 512", d:"M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V160H256c-17.7 0-32-14.3-32-32V0H64zM256 0V128H384L256 0zM112 256H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16z" },
  download:   { vb:"0 0 512 512", d:"M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V416c0-35.3-28.7-64-64-64H346.5l-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352H64zm368 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z" },
  mobile:     { vb:"0 0 384 512", d:"M16 64C16 28.7 44.7 0 80 0H304c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H80c-35.3 0-64-28.7-64-64V64zM224 448a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zM304 64H80V384H304V64z" },
  plus:       { vb:"0 0 448 512", d:"M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z" },
  xmark:      { vb:"0 0 384 512", d:"M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z" },
  withdrawWallet: { vb:"0 0 512 512", paths:["M155.5,471C229.66,471 303.82,471.03 377.97,470.97C389.03,470.96 399.77,468.98 410.09,464.83C442.14,451.94 463.1,418 459.85,383.72C459.21,377.02 456.26,370.87 449.98,367.87C445.48,365.73 440.26,364.51 435.27,364.15C424.38,363.37 413.33,365.11 402.67,361.08C382.78,353.54 372.25,336.86 373.24,318.57C374.5,295.41 393.86,278.04 417.07,278C424.07,277.99 431.08,278.13 438.07,277.94C449.76,277.62 458.99,269.59 459.85,258.59C462.12,229.56 454.37,204.29 431.44,184.92C417.06,172.78 400.5,166.21 381.63,166.04C362.8,165.86 343.97,166.02 325.14,165.99C318.32,165.98 318.02,165.69 318.01,158.96C317.99,134.46 317.49,109.95 318.13,85.47C318.86,57.81 290.06,36.9 263.92,46.57C235.53,57.07 207.22,67.79 178.91,78.49C149.81,89.48 120.65,100.31 91.7,111.68C68.36,120.85 54.01,142.7 54,167.74C53.99,241.24 53.98,314.73 54.04,388.22C54.04,392.86 54.39,397.52 54.93,402.13C58.42,431.75 82.22,458.99 110.93,467.3C125.31,471.46 139.88,470.91 155.5,471M285,141.5C285,138.33 285,135.17 285,132C284.99,116.85 285.06,101.69 284.95,86.53C284.9,79.05 280.57,76.07 273.43,78.36C270.9,79.18 268.4,80.1 265.91,81.04C237.15,91.9 208.39,102.79 179.63,113.65C154.43,123.16 129.18,132.51 104.05,142.21C90.32,147.5 82.31,167.08 88.4,179.85C89.13,179.53 89.93,179.32 90.59,178.88C104.61,169.49 120.17,165.82 136.91,165.95C160.39,166.14 183.88,166 207.37,166C231.19,166 255.01,165.92 278.83,166.05C283.28,166.08 285.24,164.61 285.05,159.99C284.8,154.17 285,148.33 285,141.5M153.82,241.03C151.52,241.38 149.2,241.61 146.93,242.11C136.71,244.34 131.95,255.85 137.3,264.88C141.63,272.2 148.78,272.92 155.99,272.94C201.98,273.05 247.98,273.02 293.97,272.95C297.1,272.94 300.28,272.5 303.34,271.82C313.29,269.59 317.96,258.16 312.82,249.3C308.44,241.77 301.14,241.06 293.73,241.05C247.4,240.96 201.08,241.01 153.82,241.03","M456.4,339.95C457.6,337 459.58,334.11 459.83,331.09C460.36,324.64 460.02,318.11 459.99,311.61C459.94,303.61 455.77,299.17 447.86,299.06C437.53,298.92 427.19,298.83 416.87,299.1C409.98,299.28 403.83,301.76 399.65,307.6C394.48,314.8 393.32,322.69 397.46,330.65C401.65,338.72 408.99,342.55 417.86,342.89C427.34,343.25 436.85,343.2 446.33,342.88C449.51,342.77 452.65,341.28 456.4,339.95"] },
};


function Ico({ name, size=16, color="currentColor", style:s={} }) {
  const ic = ICONS[name];
  if (!ic) return null;
  if (ic.paths) return (
    <svg width={size} height={size} viewBox={ic.vb} fill={color} style={{flexShrink:0,display:"inline-block",...s}}>
      {ic.paths.map((d,i)=><path key={i} d={d}/>)}
    </svg>
  );
  return <svg width={size} height={size} viewBox={ic.vb} fill={color} style={{flexShrink:0,display:"inline-block",...s}}><path d={ic.d}/></svg>;
}


// ── Themes ────────────────────────────────────────────────────
const THEMES = {
  dark: {
    id:"dark", pageBg:"#0d1117", headerBg:"rgba(13,33,55,0.9)", headerBorder:"rgba(30,58,95,0.8)",
    sectionBg:"rgba(255,255,255,0.03)", sectionBorder:"#1e3a5f",
    cardBg:"rgba(255,255,255,0.02)", cardBorder:"#1e3a5f",
    inputBg:"#0a1628", inputBorder:"#1e3a5f", inputText:"#e6edf3",
    text:"#e6edf3", subText:"#4a7fa5", dimText:"#6b8fa8",
    popupBg:"#0d2137", menuBg:"#0d2137",
    tabBg:"rgba(255,255,255,0.05)", tabInactive:"#5a8fa8",
    tabActive:"rgba(0,229,160,0.18)", tabActiveBorder:"rgba(0,229,160,0.5)", tabActiveText:"#00e5a0",
  },
  light: {
    id:"light", pageBg:"#eef2f7", headerBg:"rgba(255,255,255,0.92)", headerBorder:"rgba(180,210,240,0.9)",
    sectionBg:"rgba(255,255,255,0.9)", sectionBorder:"#c5d8ee",
    cardBg:"rgba(255,255,255,0.95)", cardBorder:"#c5d8ee",
    inputBg:"#ffffff", inputBorder:"#b0c8e0", inputText:"#1a2f45",
    text:"#1a2f45", subText:"#4a7fa5", dimText:"#5a8fba",
    popupBg:"#ffffff", menuBg:"#ffffff",
    tabBg:"rgba(0,0,0,0.07)", tabInactive:"#3a6080",
    tabActive:"#1a5276", tabActiveBorder:"#1a5276", tabActiveText:"#ffffff",
  }
};


// ── Helpers ───────────────────────────────────────────────────
function today() { return new Date().toISOString().split("T")[0]; }
function currSym(code) { return CURRENCIES.find(c=>c.code===code)?.symbol||code; }
function firstName(name) { if (!name) return "User"; return name.trim().split(/\s+/)[0]; }
function fmtAmt(bdtAmt, currency, rates) {
  const r = rates||DEFAULT_RATES;
  const n = Number(bdtAmt)||0;
  const d = currency==="BDT" ? n : (n/(r.BDT||110))*(r[currency]||1);
  const sym = currSym(currency);
  if (currency==="JPY") return sym+Math.round(d).toLocaleString("en-US");
  return sym+d.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function toBase(displayAmt, currency, rates) {
  const r = rates||DEFAULT_RATES;
  const n = Number(displayAmt)||0;
  if (currency==="BDT") return n;
  return (n/(r[currency]||1))*(r.BDT||110);
}
function fromBase(bdtAmt, currency, rates) {
  const r = rates||DEFAULT_RATES;
  const n = Number(bdtAmt)||0;
  if (currency==="BDT") return n;
  return (n/(r.BDT||110))*(r[currency]||1);
}
function getLevel(totalIncomeUSD) {
  let lvl=LEVELS[0];
  for (const l of LEVELS) { if (totalIncomeUSD>=l.minUSD) lvl=l; }
  return lvl;
}
function useIsMobile(bp=640) {
  const [mob,setMob]=useState(typeof window!=="undefined"?window.innerWidth<bp:false);
  useEffect(()=>{
    const h=()=>setMob(window.innerWidth<bp);
    window.addEventListener("resize",h); return ()=>window.removeEventListener("resize",h);
  },[bp]);
  return mob;
}
function isAndroidMobile() {
  return /Android/i.test(navigator.userAgent) && /Mobile/i.test(navigator.userAgent);
}

// ── Dynamic font size — only shrinks when number is genuinely huge ──
function amtFontSize(str) {
  const l = (str||"").length;
  if (l > 22) return 11;
  if (l > 19) return 13;
  if (l > 16) return 16;
  return 18;
}

// ── Dynamic flex for dashboard cards ─────────────────────────
function cardFlex(formattedValue) {
  const l = (formattedValue||"").length;
  if (l > 17) return "3 1 200px";
  if (l > 13) return "2 1 160px";
  return "1 1 140px";
}


// ── Firebase ──────────────────────────────────────────────────
async function loadFromCloud(uid) {
  try {
    const snap = await getDoc(doc(db,"users",uid));
    if (snap.exists()) {
      const d = snap.data();
      return {
        finance:     { ...defaultFinance,     ...(d.finance||{}) },
        settings:    { currency:"BDT", theme:"dark", ...(d.settings||{}) },
        profile:     { customName:"",          ...(d.profile||{}) },
        workProfile: { ...defaultWorkProfile,  ...(d.workProfile||{}) },
      };
    }
  } catch {}
  return { finance:defaultFinance, settings:{currency:"BDT",theme:"dark"}, profile:{customName:""}, workProfile:{...defaultWorkProfile} };
}
async function saveToCloud(uid, finance, settings, profile, workProfile) {
  try { await setDoc(doc(db,"users",uid),{finance,settings,profile,workProfile},{merge:true}); }
  catch(e) { console.error("Save error:",e); }
}


// ── User Avatar ───────────────────────────────────────────────
function UserAvatar({ photoURL, size=30, t }) {
  if (photoURL) return <img src={photoURL} alt="" style={{width:size,height:size,borderRadius:"50%",border:"2px solid rgba(0,229,160,0.3)",flexShrink:0,objectFit:"cover"}} />;
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:"white",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"2px solid rgba(0,229,160,0.3)"}}>
      <Ico name="user" size={size*0.52} color="#888" />
    </div>
  );
}


// ── Confirm Popup ─────────────────────────────────────────────
function ConfirmPopup({ message, onConfirm, onCancel, t }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:t.popupBg,border:`1px solid ${t.cardBorder}`,borderRadius:20,padding:32,maxWidth:320,width:"100%",textAlign:"center",boxShadow:"0 24px 64px rgba(0,0,0,0.4)"}}>
        <div style={{fontSize:40,marginBottom:14}}>⚠️</div>
        <div style={{fontSize:17,fontWeight:800,color:t.text,marginBottom:8}}>Are you sure?</div>
        <div style={{fontSize:13,color:t.subText,marginBottom:28,lineHeight:1.6}}>{message}</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel} style={{flex:1,padding:"11px",background:"transparent",border:`1px solid ${t.cardBorder}`,borderRadius:12,color:t.subText,cursor:"pointer",fontSize:13,fontWeight:600}}>Cancel</button>
          <button onClick={onConfirm} style={{flex:1,padding:"11px",background:"rgba(255,92,92,0.15)",border:"1px solid #ff5c5c60",borderRadius:12,color:"#ff5c5c",cursor:"pointer",fontSize:13,fontWeight:700}}>Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}


// ── 3-Dot Menu ────────────────────────────────────────────────
function ThreeDotMenu({ options, t }) {
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};
    document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h);
  },[]);
  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(!open)} style={{background:"transparent",border:`1px solid ${t.cardBorder}`,borderRadius:8,width:32,height:32,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <span style={{color:t.subText,fontSize:16,lineHeight:1}}>⋯</span>
      </button>
      {open && (
        <div style={{position:"absolute",right:0,top:"calc(100% + 6px)",background:t.menuBg,border:`1px solid ${t.cardBorder}`,borderRadius:14,zIndex:500,minWidth:170,boxShadow:"0 8px 32px rgba(0,0,0,0.3)",overflow:"hidden"}}>
          {options.map((opt,i)=>(
            <button key={i} onClick={()=>{opt.action();setOpen(false);}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"11px 16px",background:"transparent",border:"none",color:opt.danger?"#ff5c5c":t.text,cursor:"pointer",fontSize:13,fontWeight:opt.danger?700:500,borderBottom:i<options.length-1?`1px solid ${t.cardBorder}`:"none",textAlign:"left"}}>
              {opt.icon}{opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


// ── Hamburger Menu ────────────────────────────────────────────
function HamburgerMenu({ onLogout, onProfile, onSettings, t }) {
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};
    document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h);
  },[]);
  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(!open)} style={{background:"rgba(255,255,255,0.08)",border:`1px solid ${t.headerBorder}`,borderRadius:9,width:36,height:36,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <Ico name="bars" size={16} color={t.text}/>
      </button>
      {open && (
        <div style={{position:"absolute",right:0,top:"calc(100% + 8px)",background:t.menuBg,border:`1px solid ${t.cardBorder}`,borderRadius:18,zIndex:9999,minWidth:200,boxShadow:"0 12px 40px rgba(0,0,0,0.3)",overflow:"hidden"}}>
          {[
            {icon:<Ico name="circleUser" size={14} color={t.subText}/>, label:"Profile",  action:onProfile},
            {icon:<Ico name="gear"       size={14} color={t.subText}/>, label:"Settings", action:onSettings},
          ].map((item,i)=>(
            <button key={i} onClick={()=>{item.action();setOpen(false);}} style={{display:"flex",alignItems:"center",gap:12,width:"100%",padding:"12px 18px",background:"transparent",border:"none",color:t.text,cursor:"pointer",fontSize:14,fontWeight:500,borderBottom:`1px solid ${t.cardBorder}`,textAlign:"left"}}>
              {item.icon}{item.label}
            </button>
          ))}
          <a href="https://shakilxvs.wordpress.com/" target="_blank" rel="noreferrer" onClick={()=>setOpen(false)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 18px",color:t.text,textDecoration:"none",fontSize:14,fontWeight:500,borderBottom:`1px solid ${t.cardBorder}`}}>
            <Ico name="at" size={14} color={t.subText}/> Support
          </a>
          <button onClick={()=>{onLogout();setOpen(false);}} style={{display:"flex",alignItems:"center",gap:12,width:"100%",padding:"12px 18px",background:"transparent",border:"none",color:"#ff5c5c",cursor:"pointer",fontSize:14,fontWeight:700,textAlign:"left"}}>
            <Ico name="signout" size={14} color="#ff5c5c"/> Sign out
          </button>
        </div>
      )}
    </div>
  );
}


// ── Currency Dropdown ─────────────────────────────────────────
function CurrencyDropdown({ currency, setCurrency, rates, ratesLoading }) {
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};
    document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h);
  },[]);
  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(!open)} style={{display:"flex",alignItems:"center",gap:5,background:"rgba(0,229,160,0.1)",border:"1px solid rgba(0,229,160,0.35)",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:"#00e5a0",fontSize:12,fontWeight:800}}>
        <span style={{fontSize:14}}>{currSym(currency)}</span>
        <span>{currency}</span>
        <span style={{fontSize:9,opacity:0.6}}>{open?"▲":"▼"}</span>
      </button>
      {open && (
        <div style={{position:"absolute",top:"calc(100% + 8px)",left:0,background:"#0d2137",border:"1px solid #1e3a5f",borderRadius:16,zIndex:9999,minWidth:220,boxShadow:"0 12px 40px rgba(0,0,0,0.5)",overflow:"hidden"}}>
          <div style={{padding:"8px 14px",borderBottom:"1px solid #1e3a5f",fontSize:10,color:"#4a7fa5"}}>
            {ratesLoading?"⏳ Fetching live rates…":"🔴 Live exchange rates"}
          </div>
          <div style={{maxHeight:300,overflowY:"auto",scrollbarWidth:"none"}}>
            {CURRENCIES.map(c=>{
              const bdtPer = rates&&rates.BDT&&rates[c.code] ? (rates.BDT/rates[c.code]) : null;
              return (
                <button key={c.code} onClick={()=>{setCurrency(c.code);setOpen(false);}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 14px",background:currency===c.code?"rgba(0,229,160,0.1)":"transparent",border:"none",cursor:"pointer",color:currency===c.code?"#00e5a0":"#e6edf3",fontSize:13,fontWeight:currency===c.code?700:400}}>
                  <span style={{fontSize:17,minWidth:28,textAlign:"center",fontWeight:800}}>{c.symbol}</span>
                  <div style={{flex:1,textAlign:"left"}}>
                    <div style={{fontWeight:600}}>{c.code}</div>
                    <div style={{fontSize:10,color:"#4a7fa5"}}>{c.name}</div>
                  </div>
                  <div style={{fontSize:10,color:"#4a7fa5"}}>{c.code==="BDT"?"Base":bdtPer?`৳${bdtPer.toFixed(2)}`:"—"}</div>
                  {currency===c.code&&<span style={{color:"#00e5a0",marginLeft:4}}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


// ── Inline Edit ───────────────────────────────────────────────
function InlineEdit({ item, fields, onSave, onCancel, t, currency, rates }) {
  const [vals,setVals]=useState(()=>{
    const o={};
    fields.forEach(f=>{
      if (f.isAmount) {
        const d=fromBase(item[f.key],currency,rates);
        o[f.key]=d===0?"":parseFloat(d.toFixed(currency==="JPY"?0:2)).toString();
      } else { o[f.key]=item[f.key]??""; }
    });
    return o;
  });
  const handleSave=()=>{
    const out={};
    fields.forEach(f=>{out[f.key]=f.isAmount?toBase(vals[f.key],currency,rates):vals[f.key];});
    onSave(out);
  };
  return (
    <div style={{background:t.inputBg,border:"1px solid #00e5a040",borderRadius:12,padding:16,marginTop:12}}>
      {fields.map(f=>(
        <div key={f.key} style={{marginBottom:10}}>
          <div style={{fontSize:10,color:t.subText,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>{f.label}{f.isAmount?` (${currSym(currency)})`:""}</div>
          {f.type==="select"
            ?<select style={iSt(t)} value={vals[f.key]} onChange={e=>setVals(v=>({...v,[f.key]:e.target.value}))}>{f.options.map(o=><option key={o}>{o}</option>)}</select>
            :<input style={iSt(t)} type={f.type||"text"} value={vals[f.key]} onChange={e=>setVals(v=>({...v,[f.key]:e.target.value}))}/>}
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <button onClick={handleSave} style={{...bSt("#00e5a0"),padding:"7px 16px",fontSize:12,display:"flex",alignItems:"center",gap:6}}><Ico name="squareCheck" size={12} color="#00e5a0"/>Save</button>
        <button onClick={onCancel} style={{...bSt("#4a7fa5"),padding:"7px 16px",fontSize:12}}>Cancel</button>
      </div>
    </div>
  );
}


// ── Invoice Printer ───────────────────────────────────────────
function printInvoice(inv, wp, sym) {
  const items = inv.items||[];
  const subtotal = items.reduce((s,i)=>s+(Number(i.qty)||0)*(Number(i.rate)||0),0);
  const taxAmt   = subtotal*(Number(inv.taxRate)||0)/100;
  const discAmt  = Number(inv.discount)||0;
  const total    = subtotal+taxAmt-discAmt;
  const fmt = n => sym+n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});

  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${inv.invoiceNumber||""}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#f8fafc;color:#1a2f45;padding:40px}
  .page{max-width:750px;margin:0 auto;background:white;border-radius:16px;padding:48px;box-shadow:0 4px 40px rgba(0,0,0,0.08)}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:32px;border-bottom:2px solid #e2ecf5}
  .brand{font-size:26px;font-weight:900;color:#0d4a6e;letter-spacing:-0.5px}
  .brand-sub{font-size:12px;color:#6b8fa8;margin-top:2px}
  .inv-meta{text-align:right}
  .inv-title{font-size:28px;font-weight:800;color:#00b37a;letter-spacing:-1px}
  .inv-number{font-size:13px;color:#6b8fa8;margin-top:4px;font-weight:600}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:36px}
  .party-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#4a7fa5;margin-bottom:8px}
  .party-name{font-size:16px;font-weight:700;color:#1a2f45;margin-bottom:4px}
  .party-detail{font-size:12px;color:#6b8fa8;line-height:1.7}
  .dates{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;background:#e8f4ff;border-radius:12px;padding:16px 20px;margin-bottom:32px}
  .date-item label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7fa5;display:block;margin-bottom:4px}
  .date-item span{font-size:14px;font-weight:700;color:#1a2f45}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  thead tr{background:#0d4a6e!important}
  thead th{padding:12px 16px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#ffffff!important}
  thead th:last-child,thead th:nth-last-child(2),thead th:nth-last-child(3){text-align:right}
  tbody tr{border-bottom:1px solid #e8f0f8}
  tbody tr:nth-child(even){background:#f8fbff!important}
  td{padding:12px 16px;font-size:13px;color:#1a2f45}
  td:nth-last-child(1),td:nth-last-child(2),td:nth-last-child(3){text-align:right}
  .totals{margin-left:auto;width:280px}
  .total-row{display:flex;justify-content:space-between;padding:8px 0;font-size:13px;color:#4a7fa5;border-bottom:1px solid #e8f0f8}
  .total-final{display:flex;justify-content:space-between;padding:14px 16px;background:#0d4a6e!important;border-radius:10px;margin-top:8px;border:2px solid #0d4a6e}
  .total-final span:first-child{color:#a8d4f5!important;font-size:13px;font-weight:600}
  .total-final span:last-child{color:#ffffff!important;font-size:20px;font-weight:900}
  .footer{margin-top:36px;padding-top:24px;border-top:1px solid #e2ecf5;display:grid;grid-template-columns:1fr 1fr;gap:24px}
  .footer-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7fa5;margin-bottom:6px}
  .footer-val{font-size:12px;color:#1a2f45;line-height:1.6}
  .badge{display:inline-block;background:#dcfce7!important;color:#166534!important;border-radius:99px;padding:3px 12px;font-size:11px;font-weight:700;margin-bottom:16px}
  @media print{body{background:white;padding:0}.page{box-shadow:none;border-radius:0;padding:32px}thead tr{background:#0d4a6e!important}.total-final{background:#0d4a6e!important}}
</style></head><body><div class="page">
  <div class="header">
    <div>
      <div class="brand">${wp.workName||"Your Business"}</div>
      <div class="brand-sub">${wp.website||""}</div>
      ${wp.taxId?`<div class="brand-sub">Tax/VAT: ${wp.taxId}</div>`:""}
    </div>
    <div class="inv-meta">
      <div class="inv-title">INVOICE</div>
      <div class="inv-number"># ${inv.invoiceNumber||"—"}</div>
      <div style="margin-top:8px"><span class="badge">Unpaid</span></div>
    </div>
  </div>
  <div class="parties">
    <div>
      <div class="party-label">From</div>
      <div class="party-name">${wp.workName||""}</div>
      <div class="party-detail">${[wp.workEmail,wp.workPhone,wp.workAddress,wp.workCity,wp.workCountry].filter(Boolean).join("<br>")}</div>
    </div>
    <div>
      <div class="party-label">Bill To</div>
      <div class="party-name">${inv.clientName||"Client"}</div>
      <div class="party-detail">${[inv.clientEmail,inv.clientAddress,inv.clientCity,inv.clientCountry].filter(Boolean).join("<br>")}</div>
    </div>
  </div>
  <div class="dates">
    <div class="date-item"><label>Issue Date</label><span>${inv.issueDate||""}</span></div>
    <div class="date-item"><label>Due Date</label><span>${inv.dueDate||""}</span></div>
    <div class="date-item"><label>Currency</label><span>${sym} ${inv.currency||""}</span></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
    <tbody>
      ${items.map((it,i)=>`<tr><td style="color:#4a7fa5;font-weight:700">${i+1}</td><td>${it.desc||""}</td><td>${Number(it.qty)||0}</td><td>${fmt(Number(it.rate)||0)}</td><td style="font-weight:700">${fmt((Number(it.qty)||0)*(Number(it.rate)||0))}</td></tr>`).join("")}
    </tbody>
  </table>
  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
    ${Number(inv.taxRate)>0?`<div class="total-row"><span>Tax (${inv.taxRate}%)</span><span>${fmt(taxAmt)}</span></div>`:""}
    ${discAmt>0?`<div class="total-row"><span>Discount</span><span>-${fmt(discAmt)}</span></div>`:""}
    <div class="total-final"><span>Total Due</span><span>${fmt(total)}</span></div>
  </div>
  ${(inv.notes||wp.paymentTerms)?`<div class="footer">
    ${wp.paymentTerms?`<div><div class="footer-label">Payment Terms</div><div class="footer-val">${wp.paymentTerms}</div></div>`:""}
    ${inv.notes?`<div><div class="footer-label">Notes</div><div class="footer-val">${inv.notes}</div></div>`:""}
  </div>`:""}
</div><script>window.onload=()=>{window.print();}<\/script></body></html>`;

  const win=window.open("","_blank","width=900,height=700");
  if (win) { win.document.write(html); win.document.close(); }
}


// ── ROOT APP ──────────────────────────────────────────────────
export default function App() {
  const [user,         setUser]         = useState(null);
  const [finance,      setFinance]      = useState(defaultFinance);
  const [settings,     setSettings]     = useState({currency:"BDT",theme:"dark"});
  const [profile,      setProfile]      = useState({customName:""});
  const [workProfile,  setWorkProfile]  = useState({...defaultWorkProfile});
  const [rates,        setRates]        = useState(DEFAULT_RATES);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [authLoading,  setAuthLoading]  = useState(true);
  const [tab,          setTab]          = useState("dashboard");
  const [page,         setPage]         = useState("main");
  const [confirm,      setConfirm]      = useState(null);
  const [invoiceOpen,  setInvoiceOpen]  = useState(false);
  const [installPrompt,setInstallPrompt]= useState(null);

  const isMobile = useIsMobile();
  const t        = THEMES[settings.theme]||THEMES.dark;
  const currency = settings.currency||"BDT";
  const theme    = settings.theme||"dark";
  const dispName = profile.customName||user?.displayName||user?.email?.split("@")[0]||"User";
  const fname    = firstName(dispName);
  const f        = n=>fmtAmt(n,currency,rates);

  // Live exchange rates
  useEffect(()=>{
    const fetchRates=async()=>{
      try{
        setRatesLoading(true);
        const res=await fetch("https://open.er-api.com/v6/latest/USD");
        const json=await res.json();
        if(json?.rates) setRates(json.rates);
      }catch{}finally{setRatesLoading(false);}
    };
    fetchRates();
    const iv=setInterval(fetchRates,30*60*1000);
    return()=>clearInterval(iv);
  },[]);

  // Auth listener
  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,async u=>{
      setUser(u);
      if(u){
        const cloud=await loadFromCloud(u.uid);
        setFinance(cloud.finance);
        setSettings(cloud.settings);
        setProfile(cloud.profile);
        setWorkProfile(cloud.workProfile);
      }
      setAuthLoading(false);
    });
    return unsub;
  },[]);

  // Auto-save
  useEffect(()=>{
    if(!user) return;
    const timer=setTimeout(()=>saveToCloud(user.uid,finance,settings,profile,workProfile),800);
    return()=>clearTimeout(timer);
  },[finance,settings,profile,workProfile,user]);

  // PWA install prompt
  useEffect(()=>{
    const h=e=>{e.preventDefault();setInstallPrompt(e);};
    window.addEventListener("beforeinstallprompt",h);
    return()=>window.removeEventListener("beforeinstallprompt",h);
  },[]);

  const login  = ()=>signInWithPopup(auth,provider);
  const logout = ()=>{ signOut(auth); setFinance(defaultFinance); setProfile({customName:""}); setWorkProfile({...defaultWorkProfile}); setSettings({currency:"BDT",theme:"dark"}); setTab("dashboard"); setPage("main"); };
  const setSetting = (key,val)=>setSettings(s=>({...s,[key]:val}));

  // Data ops
  const addItem       = (type,item)      => setFinance(d=>({...d,[type]:[item,...d[type]]}));
  const updateItem    = (type,id,fields) => setFinance(d=>({...d,[type]:d[type].map(i=>i.id===id?{...i,...fields}:i)}));
  const deleteItem    = (type,id)        => setFinance(d=>({...d,[type]:d[type].filter(i=>i.id!==id)}));
  const confirmDelete = (type,id,name)   => setConfirm({message:`"${name}" will be permanently deleted.`,onConfirm:()=>{deleteItem(type,id);setConfirm(null);}});
  const markPaid      = id=>{
    const it=finance.pending.find(p=>p.id===id);
    if(!it) return;
    setFinance(d=>({...d,pending:d.pending.filter(p=>p.id!==id),income:[{...it,id:Date.now(),date:today(),category:"Project",note:"From pending: "+it.client},...d.income]}));
  };
  const completePlan=(id,completionDate)=>{
    const plan=finance.plans.find(p=>p.id===id);
    if(!plan) return;
    setFinance(d=>({...d,plans:d.plans.map(p=>p.id===id?{...p,completed:true,completionDate}:p),expenses:[{id:Date.now(),category:plan.category||"Other",amount:plan.budget,date:completionDate,note:"From plan: "+plan.title},...d.expenses]}));
  };

  const totalIncome   = finance.income.reduce((s,i)=>s+Number(i.amount),0);
  const totalExpenses = finance.expenses.reduce((s,i)=>s+Number(i.amount),0);
  const totalPending  = finance.pending.reduce((s,i)=>s+Number(i.amount),0);
  const netBalance    = totalIncome-totalExpenses;
  const thisMonth     = new Date().toISOString().slice(0,7);
  const monthIncome   = finance.income.filter(i=>i.date?.startsWith(thisMonth)).reduce((s,i)=>s+Number(i.amount),0);
  const monthExpenses = finance.expenses.filter(i=>i.date?.startsWith(thisMonth)).reduce((s,i)=>s+Number(i.amount),0);

  if (authLoading) return <Splash/>;
  if (!user)       return <LoginScreen onGoogleLogin={login}/>;

  const tabs=[
    {id:"dashboard",label:"Dashboard", icon:"chartLine",      color:"#00e5a0"},
    {id:"income",   label:"Income",    icon:"wallet",         color:"#00e5a0"},
    {id:"pending",  label:"Pending",   icon:"hourglass",      color:"#f0a500"},
    {id:"expenses", label:"Expenses",  icon:"cardFill",       color:"#ff5c5c"},
    {id:"plans",    label:"Plans",     icon:"bullseye",       color:"#9370db"},
  ];
  const commonProps={f,t,currency,rates};

  return (
    <div style={{minHeight:"100vh",background:t.pageBg,fontFamily:"'Segoe UI',system-ui,sans-serif",color:t.text,transition:"background 0.3s"}}>
      {confirm && <ConfirmPopup message={confirm.message} onConfirm={confirm.onConfirm} onCancel={()=>setConfirm(null)} t={t}/>}

      {page==="profile"  && <ProfilePage  user={user} profile={profile} setProfile={setProfile} workProfile={workProfile} setWorkProfile={setWorkProfile} finance={finance} f={f} t={t} currency={currency} rates={rates} isMobile={isMobile} onClose={()=>setPage("main")}/>}
      {page==="settings" && <SettingsPage settings={settings} setSetting={setSetting} t={t} installPrompt={installPrompt} setInstallPrompt={setInstallPrompt} onClose={()=>setPage("main")}/>}
      {invoiceOpen       && <InvoiceModal workProfile={workProfile} currency={currency} rates={rates} t={t} onClose={()=>setInvoiceOpen(false)} onSetWorkProfile={()=>{setInvoiceOpen(false);setPage("profile");}} finance={finance} addPending={item=>addItem("pending",item)}/>}

      {/* ── Floating Header ── */}
      <div style={{padding:"14px 14px 0",position:"sticky",top:0,zIndex:100}}>
        <div style={{background:t.headerBg,border:`1px solid ${t.headerBorder}`,borderRadius:18,padding:isMobile?"10px 14px":"11px 18px",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",boxShadow:"0 8px 32px rgba(0,0,0,0.15)"}}>
          {isMobile?(
            <div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <Ico name="wallet" size={18} color="#00e5a0"/>
                  <span style={{fontSize:16,fontWeight:800,color:"#00e5a0",letterSpacing:"-0.5px"}}>Finance Flow</span>
                  <CurrencyDropdown currency={currency} setCurrency={c=>setSetting("currency",c)} rates={rates} ratesLoading={ratesLoading}/>
                </div>
                <HamburgerMenu onLogout={logout} onProfile={()=>setPage("profile")} onSettings={()=>setPage("settings")} t={t}/>
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{background:"rgba(0,229,160,0.1)",border:"1px solid rgba(0,229,160,0.3)",borderRadius:10,padding:"5px 11px",fontSize:12,fontWeight:700,color:"#00e5a0"}}>Net: {f(netBalance)}</div>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <span style={{fontSize:12,color:t.dimText}}>{fname}</span>
                  <UserAvatar photoURL={user.photoURL} size={28} t={t}/>
                </div>
              </div>
            </div>
          ):(
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <Ico name="wallet" size={20} color="#00e5a0"/>
                <div>
                  <div style={{fontSize:16,fontWeight:800,color:"#00e5a0",letterSpacing:"-0.5px",lineHeight:1.2}}>Finance Flow</div>
                  <div style={{fontSize:10,color:t.subText}}>Personal finance manager</div>
                </div>
                <CurrencyDropdown currency={currency} setCurrency={c=>setSetting("currency",c)} rates={rates} ratesLoading={ratesLoading}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{background:"rgba(0,229,160,0.1)",border:"1px solid rgba(0,229,160,0.3)",borderRadius:10,padding:"6px 12px",fontSize:13,fontWeight:700,color:"#00e5a0",whiteSpace:"nowrap"}}>Net: {f(netBalance)}</div>
                <UserAvatar photoURL={user.photoURL} size={30} t={t}/>
                <span style={{fontSize:12,color:t.dimText,maxWidth:72,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fname}</span>
                <HamburgerMenu onLogout={logout} onProfile={()=>setPage("profile")} onSettings={()=>setPage("settings")} t={t}/>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{display:"flex",justifyContent:"center",padding:"12px 14px 0"}}>
        <div style={{display:"flex",gap:4,overflowX:"auto",scrollbarWidth:"none",WebkitOverflowScrolling:"touch",background:t.tabBg,borderRadius:14,padding:"5px 6px",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"}}>
          {tabs.map(tb=>(
            <button key={tb.id} onClick={()=>setTab(tb.id)} style={{background:tab===tb.id?t.tabActive:"transparent",border:`1px solid ${tab===tb.id?t.tabActiveBorder:"transparent"}`,color:tab===tb.id?t.tabActiveText:t.tabInactive,borderRadius:10,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:tab===tb.id?700:400,whiteSpace:"nowrap",transition:"all 0.2s",flexShrink:0,display:"flex",alignItems:"center",gap:6}}>
              <Ico name={tb.icon} size={12} color={tab===tb.id?t.tabActiveText:tb.color} style={{opacity: tab===tb.id?1:0.65}}/>{tb.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{maxWidth:820,margin:"0 auto",padding:"14px 14px 48px"}}>
        {tab==="dashboard" && <Dashboard totalIncome={totalIncome} totalPending={totalPending} totalExpenses={totalExpenses} netBalance={netBalance} monthIncome={monthIncome} monthExpenses={monthExpenses} finance={finance} fname={fname} {...commonProps}/>}
        {tab==="income"    && <IncomeTab   data={finance.income}   onAdd={i=>addItem("income",i)}   onUpdate={(id,v)=>updateItem("income",id,v)}   onDelete={(id,n)=>confirmDelete("income",id,n)}   {...commonProps}/>}
        {tab==="pending"   && <PendingTab  data={finance.pending}  onAdd={i=>addItem("pending",i)}  onMarkPaid={markPaid} onUpdate={(id,v)=>updateItem("pending",id,v)} onDelete={(id,n)=>confirmDelete("pending",id,n)} onOpenInvoice={()=>setInvoiceOpen(true)} {...commonProps}/>}
        {tab==="expenses"  && <ExpensesTab data={finance.expenses} onAdd={i=>addItem("expenses",i)} onUpdate={(id,v)=>updateItem("expenses",id,v)} onDelete={(id,n)=>confirmDelete("expenses",id,n)} {...commonProps}/>}
        {tab==="plans"     && <PlansTab    data={finance.plans}    onAdd={i=>addItem("plans",i)}    onUpdate={(id,v)=>updateItem("plans",id,v)}    onDelete={(id,n)=>confirmDelete("plans",id,n)}    onComplete={completePlan} {...commonProps}/>}
      </div>
    </div>
  );
}


// ── SPLASH ────────────────────────────────────────────────────
function Splash() {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",background:"#0d1117",gap:16}}>
      <Ico name="wallet" size={52} color="#00e5a0"/>
      <div style={{color:"#00e5a0",fontWeight:800,fontSize:22}}>Finance Flow</div>
      <div style={{color:"#4a7fa5",fontSize:13}}>Loading your data…</div>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────
function LoginScreen({ onGoogleLogin }) {
  const [mode,    setMode]    = useState("signin");
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [password,setPassword]= useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const errMap={"auth/user-not-found":"No account found with this email.","auth/wrong-password":"Incorrect password.","auth/email-already-in-use":"Email already registered. Sign in instead.","auth/weak-password":"Password must be at least 6 characters.","auth/invalid-email":"Please enter a valid email.","auth/too-many-requests":"Too many attempts. Please try again later.","auth/invalid-credential":"Incorrect email or password."};

  const handleEmail=async()=>{
    if (!email||!password){setError("Please fill in all fields.");return;}
    if (mode==="signup"&&!name.trim()){setError("Please enter your full name.");return;}
    setLoading(true);setError("");
    try {
      if (mode==="signup"){
        const cred=await createUserWithEmailAndPassword(auth,email,password);
        if(name.trim()) await updateProfile(cred.user,{displayName:name.trim()});
        await sendEmailVerification(cred.user);
        setMode("verify");
      } else {
        const cred=await signInWithEmailAndPassword(auth,email,password);
        if(!cred.user.emailVerified&&cred.user.providerData[0]?.providerId==="password"){
          setMode("verify"); await signOut(auth);
        }
      }
    } catch(e){setError(errMap[e.code]||"Something went wrong. Please try again.");}
    finally{setLoading(false);}
  };
  const inp={width:"100%",background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:10,color:"#e6edf3",padding:"11px 14px",fontSize:14,boxSizing:"border-box",outline:"none"};
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"linear-gradient(135deg,#0d1117 0%,#0f1923 100%)",fontFamily:"'Segoe UI',system-ui,sans-serif",padding:20}}>
      <div style={{textAlign:"center",maxWidth:400,width:"100%"}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><Ico name="wallet" size={54} color="#00e5a0"/></div>
        <div style={{fontSize:32,fontWeight:900,color:"#00e5a0",letterSpacing:"-1px",marginBottom:8}}>Finance Flow</div>
        <div style={{fontSize:14,color:"#4a7fa5",marginBottom:28,lineHeight:1.6}}>Your personal finance manager.<br/>Track income, pending & expenses.</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:7,justifyContent:"center",marginBottom:28}}>
          {["💚 Income","⏳ Pending","🔴 Expenses","🎯 Plans","☁️ Cloud Sync","🔒 Private"].map(lbl=>(
            <div key={lbl} style={{background:"rgba(255,255,255,0.04)",border:"1px solid #1e3a5f",borderRadius:99,padding:"4px 12px",fontSize:11,color:"#6b8fa8"}}>{lbl}</div>
          ))}
        </div>
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid #1e3a5f",borderRadius:20,padding:"26px 22px"}}>
          {mode!=="verify"&&<div style={{display:"flex",background:"rgba(255,255,255,0.05)",borderRadius:12,padding:4,marginBottom:20}}>
            {["signin","signup"].map(m=>(
              <button key={m} onClick={()=>{setMode(m);setError("");}} style={{flex:1,padding:"9px",background:mode===m?"rgba(0,229,160,0.18)":"transparent",border:mode===m?"1px solid rgba(0,229,160,0.4)":"1px solid transparent",borderRadius:10,color:mode===m?"#00e5a0":"#4a7fa5",cursor:"pointer",fontSize:13,fontWeight:mode===m?700:400}}>
                {m==="signin"?"Sign In":"Create Account"}
              </button>
            ))}
          </div>}
          {mode==="verify"&&(
            <div style={{textAlign:"center",padding:"8px 0 20px"}}>
              <div style={{fontSize:48,marginBottom:14}}>📧</div>
              <div style={{fontSize:17,fontWeight:800,color:"#00e5a0",marginBottom:10}}>Check your inbox!</div>
              <div style={{fontSize:13,color:"#4a7fa5",lineHeight:1.8,marginBottom:24}}>A verification link was sent to<br/><strong style={{color:"#e6edf3"}}>{email}</strong>.<br/>Click the link, then come back to sign in.</div>
              <button onClick={()=>{setMode("signin");setError("");}} style={{width:"100%",padding:"13px",background:"rgba(0,229,160,0.18)",border:"1px solid rgba(0,229,160,0.5)",borderRadius:12,color:"#00e5a0",cursor:"pointer",fontSize:14,fontWeight:700,marginBottom:12}}>
                <Ico name="squareCheck" size={14} color="#00e5a0" style={{marginRight:8,verticalAlign:"middle"}}/> I verified — Sign In
              </button>
              <div style={{fontSize:11,color:"#4a7fa5"}}>Didn't get it? Check spam or try again.</div>
            </div>
          )}
          {mode!=="verify"&&<>
            {mode==="signup"&&<div style={{marginBottom:12,textAlign:"left"}}><div style={{fontSize:10,color:"#4a7fa5",marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>Full Name</div><input value={name} onChange={e=>{setName(e.target.value);setError("");}} placeholder="e.g. Shakil Ahmed" style={inp}/></div>}
            <div style={{marginBottom:12,textAlign:"left"}}><div style={{fontSize:10,color:"#4a7fa5",marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>Email</div><input type="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}} placeholder="you@example.com" style={inp}/></div>
            <div style={{marginBottom:error?10:18,textAlign:"left"}}><div style={{fontSize:10,color:"#4a7fa5",marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>Password</div><input type="password" value={password} onChange={e=>{setPassword(e.target.value);setError("");}} placeholder={mode==="signup"?"Min. 6 characters":"Enter your password"} onKeyDown={e=>e.key==="Enter"&&handleEmail()} style={inp}/></div>
            {error&&<div style={{fontSize:12,color:"#ff5c5c",background:"rgba(255,92,92,0.1)",border:"1px solid #ff5c5c30",borderRadius:8,padding:"8px 12px",marginBottom:14,textAlign:"left"}}>⚠️ {error}</div>}
            <button onClick={handleEmail} disabled={loading} style={{width:"100%",padding:"13px",background:loading?"rgba(0,229,160,0.07)":"rgba(0,229,160,0.18)",border:"1px solid rgba(0,229,160,0.5)",borderRadius:12,color:"#00e5a0",cursor:loading?"not-allowed":"pointer",fontSize:14,fontWeight:700,marginBottom:14}}>
              {loading?"Please wait…":mode==="signup"?"Create Account":"Sign In"}
            </button>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <div style={{flex:1,height:1,background:"#1e3a5f"}}/><div style={{fontSize:11,color:"#4a7fa5"}}>or</div><div style={{flex:1,height:1,background:"#1e3a5f"}}/>
            </div>
            <button onClick={onGoogleLogin} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,width:"100%",padding:"13px 20px",background:"white",border:"none",borderRadius:12,cursor:"pointer",fontSize:14,fontWeight:700,color:"#1a1a1a",boxShadow:"0 4px 20px rgba(0,0,0,0.25)",transition:"transform 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)"}} onMouseLeave={e=>{e.currentTarget.style.transform="none"}}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>
          </>}
        </div>
        <div style={{fontSize:11,color:"#2a4a65",marginTop:16}}>Join free today · Your data stays private · No credit card needed</div>
      </div>
    </div>
  );
}

// ── INVOICE MODAL ─────────────────────────────────────────────
function InvoiceModal({ workProfile, currency, rates, t, onClose, onSetWorkProfile, finance, addPending }) {
  const hasWorkProfile = workProfile.workName && workProfile.workEmail;
  const sym = currSym(currency);
  const invoiceNum = `${workProfile.invoicePrefix||"INV-"}${String((workProfile.invoiceCount||0)+1).padStart(3,"0")}${workProfile.invoiceSuffix||""}`;

  const [inv, setInv] = useState({
    invoiceNumber: invoiceNum,
    issueDate: today(),
    dueDate: "",
    currency: currency,
    clientName:"", clientEmail:"", clientAddress:"", clientCity:"", clientCountry:"",
    taxRate:"", discount:"",
    notes: workProfile.invoiceNotes||"",
    items:[{desc:"",qty:"1",rate:""}],
  });
  const setF=(k,v)=>setInv(p=>({...p,[k]:v}));
  const setItem=(i,k,v)=>setInv(p=>({...p,items:p.items.map((it,idx)=>idx===i?{...it,[k]:v}:it)}));
  const addItem=()=>setInv(p=>({...p,items:[...p.items,{desc:"",qty:"1",rate:""}]}));
  const removeItem=i=>setInv(p=>({...p,items:p.items.filter((_,idx)=>idx!==i)}));

  const subtotal = inv.items.reduce((s,i)=>s+(Number(i.qty)||0)*(Number(i.rate)||0),0);
  const taxAmt   = subtotal*(Number(inv.taxRate)||0)/100;
  const discAmt  = Number(inv.discount)||0;
  const total    = subtotal+taxAmt-discAmt;
  const fmt      = n=>sym+n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});

  const handleDownload=()=>{ printInvoice(inv, workProfile, sym); };

  const ovSt={position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:9500,display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"20px 14px 48px"};
  const boxSt={background:t.pageBg,border:`1px solid ${t.sectionBorder}`,borderRadius:20,width:"100%",maxWidth:700,marginTop:0};

  if (!hasWorkProfile) {
    return (
      <div style={ovSt}>
        <div style={{...boxSt,padding:40,textAlign:"center",marginTop:60}}>
          <Ico name="invoice" size={48} color="#00e5a0" style={{marginBottom:16}}/>
          <div style={{fontSize:20,fontWeight:800,color:t.text,marginBottom:10}}>Set up your Work Profile first</div>
          <div style={{fontSize:14,color:t.subText,lineHeight:1.7,marginBottom:28,maxWidth:360,margin:"0 auto 28px"}}>
            To generate professional invoices, add your business name, email, and contact details in your Work Profile.
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            <button onClick={onSetWorkProfile} style={{...bSt("#00e5a0"),padding:"12px 24px",fontSize:14}}>
              <Ico name="circleUser" size={14} color="#00e5a0" style={{marginRight:8,verticalAlign:"middle"}}/>Go to Work Profile
            </button>
            <button onClick={onClose} style={{...bSt("#4a7fa5"),padding:"12px 20px",fontSize:14}}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={ovSt}>
      <div style={boxSt}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${t.sectionBorder}`,display:"flex",alignItems:"center",justifyContent:"space-between",borderRadius:"20px 20px 0 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Ico name="invoice" size={20} color="#00e5a0"/>
            <div style={{fontSize:18,fontWeight:800,color:t.text}}>Create Invoice</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:`1px solid ${t.cardBorder}`,borderRadius:9,width:34,height:34,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Ico name="xmark" size={14} color={t.subText}/>
          </button>
        </div>

        <div style={{padding:"20px 24px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            <div style={{gridColumn:"1/-1"}}><ILbl t={t}>Invoice #</ILbl><input style={iSt(t)} value={inv.invoiceNumber} onChange={e=>setF("invoiceNumber",e.target.value)}/></div>
            <div style={{minWidth:0}}><ILbl t={t}>Issue Date</ILbl><input style={{...iSt(t),width:"100%",boxSizing:"border-box"}} type="date" value={inv.issueDate} onChange={e=>setF("issueDate",e.target.value)}/></div>
            <div style={{minWidth:0}}><ILbl t={t}>Due Date</ILbl><input style={{...iSt(t),width:"100%",boxSizing:"border-box"}} type="date" value={inv.dueDate} onChange={e=>setF("dueDate",e.target.value)}/></div>
          </div>

          <div style={{background:`rgba(0,229,160,0.05)`,border:`1px solid rgba(0,229,160,0.2)`,borderRadius:14,padding:16,marginBottom:16}}>
            <div style={{fontSize:11,color:"#00e5a0",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>From (Your Business)</div>
            <div style={{fontSize:14,fontWeight:700,color:t.text}}>{workProfile.workName}</div>
            <div style={{fontSize:12,color:t.subText,marginTop:4,lineHeight:1.7}}>{[workProfile.workEmail,workProfile.workPhone,workProfile.workAddress,workProfile.workCity,workProfile.workCountry].filter(Boolean).join(" · ")}</div>
          </div>

          <div style={{background:t.sectionBg,border:`1px solid ${t.sectionBorder}`,borderRadius:14,padding:16,marginBottom:16}}>
            <div style={{fontSize:11,color:t.subText,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Bill To (Client)</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><ILbl t={t}>Client Name *</ILbl><input style={iSt(t)} value={inv.clientName} onChange={e=>setF("clientName",e.target.value)} placeholder="Client or company name"/></div>
              <div><ILbl t={t}>Client Email</ILbl><input style={iSt(t)} type="email" value={inv.clientEmail} onChange={e=>setF("clientEmail",e.target.value)} placeholder="client@example.com"/></div>
              <div><ILbl t={t}>Address</ILbl><input style={iSt(t)} value={inv.clientAddress} onChange={e=>setF("clientAddress",e.target.value)} placeholder="Street address"/></div>
              <div><ILbl t={t}>City / Country</ILbl><input style={iSt(t)} value={inv.clientCity} onChange={e=>setF("clientCity",e.target.value)} placeholder="City, Country"/></div>
            </div>
          </div>

          <div style={{background:t.sectionBg,border:`1px solid ${t.sectionBorder}`,borderRadius:14,padding:16,marginBottom:16}}>
            <div style={{fontSize:11,color:t.subText,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Services / Items</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 70px 100px 32px",gap:6,marginBottom:8}}>
              {["Description","Qty",`Rate (${sym})`,""].map((h,i)=>(
                <div key={i} style={{fontSize:10,color:t.subText,textTransform:"uppercase",letterSpacing:0.8}}>{h}</div>
              ))}
            </div>
            {inv.items.map((it,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 70px 100px 32px",gap:6,marginBottom:8,alignItems:"center"}}>
                <input style={iSt(t)} value={it.desc} onChange={e=>setItem(i,"desc",e.target.value)} placeholder="e.g. Web design"/>
                <input style={{...iSt(t),textAlign:"center"}} type="number" value={it.qty} onChange={e=>setItem(i,"qty",e.target.value)} placeholder="1"/>
                <input style={{...iSt(t),textAlign:"right"}} type="number" value={it.rate} onChange={e=>setItem(i,"rate",e.target.value)} placeholder="0.00"/>
                <button onClick={()=>removeItem(i)} disabled={inv.items.length===1} style={{background:"transparent",border:`1px solid ${t.cardBorder}`,borderRadius:8,width:32,height:34,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:inv.items.length===1?0.3:1}}>
                  <Ico name="xmark" size={12} color="#ff5c5c"/>
                </button>
              </div>
            ))}
            <button onClick={addItem} style={{...bSt("#4a7fa5"),fontSize:12,padding:"6px 14px",marginTop:4,display:"flex",alignItems:"center",gap:6}}>
              <Ico name="plus" size={11} color="#4a7fa5"/> Add Item
            </button>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            <div><ILbl t={t}>Tax Rate (%)</ILbl><input style={iSt(t)} type="number" value={inv.taxRate} onChange={e=>setF("taxRate",e.target.value)} placeholder="0"/></div>
            <div><ILbl t={t}>{`Discount (${sym})`}</ILbl><input style={iSt(t)} type="number" value={inv.discount} onChange={e=>setF("discount",e.target.value)} placeholder="0"/></div>
          </div>

          <div style={{background:`rgba(0,229,160,0.06)`,border:"1px solid rgba(0,229,160,0.25)",borderRadius:14,padding:16,marginBottom:16}}>
            {[["Subtotal",subtotal],...(Number(inv.taxRate)>0?[["Tax ("+inv.taxRate+"%)",taxAmt]]:[]),...(discAmt>0?[["Discount",-discAmt]]:[])].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:13,color:t.subText,borderBottom:`1px solid ${t.cardBorder}`}}>
                <span>{l}</span><span>{fmt(v)}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",paddingTop:12,fontSize:16,fontWeight:800}}>
              <span style={{color:t.text}}>Total Due</span>
              <span style={{color:"#00e5a0"}}>{fmt(total)}</span>
            </div>
          </div>

          <div style={{marginBottom:24}}><ILbl t={t}>Notes / Payment Terms (optional)</ILbl>
            <textarea style={{...iSt(t),minHeight:60,resize:"vertical"}} value={inv.notes} onChange={e=>setF("notes",e.target.value)} placeholder="e.g. Payment due within 30 days. Thank you for your business!"/>
          </div>

          <div style={{display:"flex",gap:10}}>
            <button onClick={handleDownload} style={{...bSt("#00e5a0"),flex:1,padding:"13px",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <Ico name="download" size={14} color="#00e5a0"/>Download PDF
            </button>
            <button onClick={onClose} style={{...bSt("#4a7fa5"),padding:"13px 20px",fontSize:14}}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
function ILbl({children,t}){return <div style={{fontSize:10,color:t.subText,marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>{children}</div>;}


// ── PROFILE PAGE ─────────────────────────────────────────────
function ProfilePage({ user, profile, setProfile, workProfile, setWorkProfile, finance, f, t, currency, rates, isMobile, onClose }) {
  const dispName  = profile.customName||user?.displayName||user?.email?.split("@")[0]||"User";
  const [editName, setEditName] = useState(false);
  const [nameVal,  setNameVal]  = useState(dispName);
  const [saving,   setSaving]   = useState(false);
  const [wpEdit,   setWpEdit]   = useState(false);
  const [wpVals,   setWpVals]   = useState({...workProfile});
  const [summaryMode, setSummaryMode] = useState("alltime");
  const [summaryMonth, setSummaryMonth] = useState(new Date().toISOString().slice(0,7));

  const saveName=async()=>{
    setSaving(true);
    try{if(user) await updateProfile(user,{displayName:nameVal.trim()});}catch{}
    setProfile(p=>({...p,customName:nameVal.trim()}));
    setSaving(false);setEditName(false);
  };
  const saveWP=()=>{ setWorkProfile({...wpVals}); setWpEdit(false); };

  const totalIncome   = finance.income.reduce((s,i)=>s+Number(i.amount),0);
  const totalExpenses = finance.expenses.reduce((s,i)=>s+Number(i.amount),0);
  const totalSavings  = totalIncome-totalExpenses;

  const allMonthsWithData = Array.from(new Set([
    ...finance.income.map(i=>i.date?.slice(0,7)),
    ...finance.expenses.map(i=>i.date?.slice(0,7))
  ].filter(Boolean)));
  const monthsCount = Math.max(1, allMonthsWithData.length);
  const avgIncome   = totalIncome/monthsCount;
  const avgExpenses = totalExpenses/monthsCount;
  const avgSavings  = avgIncome-avgExpenses;

  const allMonths=Array.from(new Set([...finance.income,...finance.expenses].map(i=>i.date?.slice(0,7)).filter(Boolean))).sort().reverse();
  const mIncome   = finance.income.filter(i=>i.date?.startsWith(summaryMonth)).reduce((s,i)=>s+Number(i.amount),0);
  const mExpenses = finance.expenses.filter(i=>i.date?.startsWith(summaryMonth)).reduce((s,i)=>s+Number(i.amount),0);
  const mSavings  = mIncome-mExpenses;

  const totalIncomeUSD = totalIncome/(rates?.BDT||110);
  const curLvl  = getLevel(totalIncomeUSD);
  const nextLvl = LEVELS[LEVELS.indexOf(curLvl)+1];
  const progress = nextLvl ? Math.min(100,((totalIncomeUSD-curLvl.minUSD)/(nextLvl.minUSD-curLvl.minUSD))*100) : 100;

  const summaryData = summaryMode==="alltime"
    ? [["Earning",totalIncome,"#00e5a0"],["Spending",totalExpenses,"#ff5c5c"],["Saving",totalSavings,totalSavings>=0?"#00e5a0":"#ff5c5c"]]
    : summaryMode==="average"
    ? [["Avg. Earning",avgIncome,"#00e5a0"],["Avg. Spending",avgExpenses,"#ff5c5c"],["Avg. Saving",avgSavings,avgSavings>=0?"#00e5a0":"#ff5c5c"]]
    : [["Earning",mIncome,"#00e5a0"],["Spending",mExpenses,"#ff5c5c"],["Saving",mSavings,mSavings>=0?"#00e5a0":"#ff5c5c"]];

  // ── Dynamic grid for summary: mobile is tighter so needs fewer cols ──
  const maxAmtLen = Math.max(...summaryData.map(([,v])=>f(v).length));
  // Mobile: 3-col only for very short (≤6 chars like "$500"), 2-col up to 14, else 1-col
  // Desktop: 3-col up to 13 chars, 2-col up to 18, else 1-col
  const summaryCols = isMobile
    ? (maxAmtLen > 14 ? "1fr" : maxAmtLen > 6 ? "1fr 1fr" : "1fr 1fr 1fr")
    : (maxAmtLen > 18 ? "1fr" : maxAmtLen > 13 ? "1fr 1fr" : "1fr 1fr 1fr");
  const summaryTextAlign = summaryCols === "1fr 1fr 1fr" ? "center" : "left";
  // Font size depends on both length AND how many cols (narrower cols need smaller font)
  const colCount = summaryCols === "1fr 1fr 1fr" ? 3 : summaryCols === "1fr 1fr" ? 2 : 1;
  function summaryFs(str) {
    const l = (str||"").length;
    if (colCount === 3) {
      // 3-col: very tight on mobile — only used for short numbers
      if (l > 8) return 14; if (l > 6) return 16; return 19;
    } else if (colCount === 2) {
      if (l > 16) return 13; if (l > 12) return 15; if (l > 9) return 17; return 20;
    } else {
      if (l > 20) return 14; if (l > 16) return 16; if (l > 12) return 18; return 22;
    }
  }

  const wpFields=[
    {k:"workName",label:"Business / Full Name",placeholder:"e.g. Shakil Ahmed Designs"},
    {k:"workEmail",label:"Business Email",placeholder:"you@yourdomain.com",type:"email"},
    {k:"workPhone",label:"Phone",placeholder:"+880 1xxx-xxxxxx"},
    {k:"website",label:"Website",placeholder:"https://yoursite.com"},
    {k:"workAddress",label:"Street Address",placeholder:"123 Main St"},
    {k:"workCity",label:"City",placeholder:"Dhaka"},
    {k:"workCountry",label:"Country",placeholder:"Bangladesh"},
    {k:"workZip",label:"ZIP / Post Code",placeholder:"1000"},
    {k:"taxId",label:"Tax / VAT ID (optional)",placeholder:"VAT-xxxxx"},
    {k:"invoicePrefix",label:"Invoice Prefix",placeholder:"INV-"},
    {k:"invoiceSuffix",label:"Invoice Suffix (optional)",placeholder:"-2026"},
    {k:"paymentTerms",label:"Default Payment Terms",placeholder:"Due within 30 days"},
    {k:"invoiceNotes",label:"Default Invoice Notes",placeholder:"Thank you for your business!"},
  ];

  return (
    <div style={{position:"fixed",inset:0,background:t.pageBg,zIndex:9000,overflowY:"auto",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <div style={{padding:"14px 14px 0"}}>
        <div style={{background:t.headerBg,border:`1px solid ${t.headerBorder}`,borderRadius:16,padding:"12px 18px",display:"flex",alignItems:"center",gap:12,backdropFilter:"blur(16px)"}}>
          <button onClick={onClose} style={{background:"transparent",border:`1px solid ${t.cardBorder}`,borderRadius:9,width:36,height:36,cursor:"pointer",color:t.text,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
          <div style={{fontSize:17,fontWeight:800,color:t.text}}>Profile</div>
        </div>
      </div>
      <div style={{maxWidth:640,margin:"20px auto",padding:"0 14px 48px"}}>

        {/* Avatar + Name */}
        <div style={{background:t.sectionBg,border:`1px solid ${t.sectionBorder}`,borderRadius:20,padding:28,textAlign:"center",marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
            {user?.photoURL ? <img src={user.photoURL} style={{width:80,height:80,borderRadius:"50%",border:"3px solid rgba(0,229,160,0.5)",objectFit:"cover"}} alt=""/> : <div style={{width:80,height:80,borderRadius:"50%",background:"white",display:"flex",alignItems:"center",justifyContent:"center",border:"3px solid rgba(0,229,160,0.4)"}}><Ico name="user" size={44} color="#888"/></div>}
          </div>
          {editName ? (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
              <input value={nameVal} onChange={e=>setNameVal(e.target.value)} style={{...iSt(t),maxWidth:260,textAlign:"center",fontSize:16}} placeholder="Your full name"/>
              <div style={{display:"flex",gap:8}}>
                <button onClick={saveName} disabled={saving} style={{...bSt("#00e5a0"),padding:"7px 18px"}}>{saving?"Saving…":<><Ico name="squareCheck" size={12} color="#00e5a0" style={{marginRight:6,verticalAlign:"middle"}}/>Save</>}</button>
                <button onClick={()=>{setEditName(false);setNameVal(dispName);}} style={{...bSt("#4a7fa5"),padding:"7px 14px"}}>Cancel</button>
              </div>
            </div>
          ):(
            <div>
              <div style={{fontSize:22,fontWeight:800,color:t.text,marginBottom:4}}>{dispName}</div>
              <div style={{fontSize:13,color:t.subText,marginBottom:12}}>{user?.email}</div>
              <button onClick={()=>setEditName(true)} style={{...bSt("#4a7fa5"),fontSize:12,padding:"6px 14px",display:"inline-flex",alignItems:"center",gap:6}}><Ico name="pen" size={11} color="#4a7fa5"/>Edit Name</button>
            </div>
          )}
        </div>

        {/* Level */}
        <div style={{background:`${curLvl.color}10`,border:`1px solid ${curLvl.color}30`,borderRadius:20,padding:24,marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <span style={{fontSize:36}}>{curLvl.emoji}</span>
            <div>
              <div style={{fontSize:18,fontWeight:800,color:curLvl.color}}>{curLvl.name}</div>
              <div style={{fontSize:12,color:t.subText}}>{curLvl.desc}</div>
            </div>
            {nextLvl&&<div style={{marginLeft:"auto",textAlign:"right"}}><div style={{fontSize:10,color:t.subText}}>Next level</div><div style={{fontSize:13,fontWeight:700,color:t.text}}>{nextLvl.emoji} {nextLvl.name}</div></div>}
          </div>
          <div style={{background:t.sectionBorder,borderRadius:99,height:10,overflow:"hidden",marginBottom:6}}>
            <div style={{width:progress+"%",background:curLvl.color,height:"100%",borderRadius:99,transition:"width 0.8s"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:t.subText}}>
            <span>${curLvl.minUSD.toLocaleString()}</span>
            {nextLvl&&<span>{progress.toFixed(1)}% → ${nextLvl.minUSD.toLocaleString()}</span>}
            {!nextLvl&&<span style={{color:curLvl.color,fontWeight:700}}>🏆 Max Level!</span>}
          </div>
          <div style={{fontSize:11,color:t.subText,marginTop:8}}>Total earned: <span style={{color:curLvl.color,fontWeight:700}}>${totalIncomeUSD.toLocaleString("en-US",{maximumFractionDigits:0})}</span></div>
        </div>

        {/* Earning Summary */}
        <div style={{background:t.sectionBg,border:`1px solid ${t.sectionBorder}`,borderRadius:20,padding:24,marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,gap:8}}>
            <div style={{fontSize:15,fontWeight:700,color:t.text,flexShrink:0}}>Earning Summary</div>
            <div style={{display:"flex",gap:3,background:t.tabBg,borderRadius:10,padding:"3px 4px",flexShrink:0}}>
              {[["alltime","All Time"],["average","Avg"],["monthly","Monthly"]].map(([id,label])=>(
                <button key={id} onClick={()=>setSummaryMode(id)} style={{padding:isMobile?"5px 8px":"6px 12px",background:summaryMode===id?t.tabActive:"transparent",border:`1px solid ${summaryMode===id?t.tabActiveBorder:"transparent"}`,borderRadius:8,color:summaryMode===id?t.tabActiveText:t.tabInactive,cursor:"pointer",fontSize:isMobile?10:11,fontWeight:summaryMode===id?700:400,whiteSpace:"nowrap"}}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {summaryMode==="monthly"&&allMonths.length>0&&(
            <select style={{...iSt(t),marginBottom:14,fontSize:13}} value={summaryMonth} onChange={e=>setSummaryMonth(e.target.value)}>
              {allMonths.map(m=><option key={m} value={m}>{new Date(m+"-01").toLocaleString("default",{month:"long",year:"numeric"})}</option>)}
            </select>
          )}
          {summaryMode==="average"&&<div style={{fontSize:11,color:t.subText,marginBottom:12}}>Based on {monthsCount} month{monthsCount!==1?"s":""} with transactions</div>}

          {/* ── Dynamic grid: 3-col normal, 2-col medium, 1-col large numbers ── */}
          <div style={{display:"grid",gridTemplateColumns:summaryCols,gap:10}}>
            {summaryData.map(([l,v,c])=>{
              const fmtStr = f(v);
              const fs = summaryFs(fmtStr);
              return (
                <div key={l} style={{background:`${c}10`,border:`1px solid ${c}30`,borderRadius:14,padding:"14px 12px",textAlign:summaryTextAlign,minWidth:0,overflow:"hidden"}}>
                  <div style={{fontSize:10,color:t.subText,textTransform:"uppercase",letterSpacing:0.8,lineHeight:1.4}}>{l}</div>
                  <div style={{
                    fontSize:fs,
                    fontWeight:800,
                    color:c,
                    marginTop:6,
                    whiteSpace:"nowrap",
                    overflow:"hidden",
                    textOverflow:"ellipsis",
                    lineHeight:1.3,
                  }}>{fmtStr}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Work Profile */}
        <div style={{background:t.sectionBg,border:`1px solid ${t.sectionBorder}`,borderRadius:20,padding:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:wpEdit?16:12}}>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:t.text}}>Work Profile</div>
              <div style={{fontSize:11,color:t.subText,marginTop:2}}>Used for invoice generation</div>
            </div>
            {!wpEdit&&<button onClick={()=>{setWpVals({...workProfile});setWpEdit(true);}} style={{...bSt("#00e5a0"),fontSize:12,padding:"6px 14px",display:"flex",alignItems:"center",gap:6}}><Ico name="pen" size={11} color="#00e5a0"/>{workProfile.workName?"Edit":"Set Up"}</button>}
          </div>
          {!wpEdit&&workProfile.workName&&(
            <div style={{fontSize:13,color:t.text,lineHeight:1.8}}>
              <div style={{fontWeight:700}}>{workProfile.workName}</div>
              {[workProfile.workEmail,workProfile.workPhone,workProfile.workAddress&&`${workProfile.workAddress}, ${workProfile.workCity}, ${workProfile.workCountry}`,workProfile.taxId&&`Tax/VAT: ${workProfile.taxId}`,workProfile.website].filter(Boolean).map((v,i)=><div key={i} style={{color:t.subText}}>{v}</div>)}
              <div style={{marginTop:8,fontSize:12,color:t.dimText}}>Invoice prefix: <strong style={{color:t.text}}>{workProfile.invoicePrefix}001{workProfile.invoiceSuffix}</strong></div>
            </div>
          )}
          {!wpEdit&&!workProfile.workName&&<div style={{textAlign:"center",padding:"24px 0",color:t.subText,fontSize:13}}>No work profile set up yet. Click "Set Up" to add your business details for invoicing.</div>}
          {wpEdit&&(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {wpFields.map(({k,label,placeholder,type})=>(
                  <div key={k} style={{gridColumn:["workName","workAddress","paymentTerms","invoiceNotes"].includes(k)?"1/-1":"auto"}}>
                    <ILbl t={t}>{label}</ILbl>
                    <input style={iSt(t)} type={type||"text"} value={wpVals[k]||""} onChange={e=>setWpVals(v=>({...v,[k]:e.target.value}))} placeholder={placeholder}/>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8,marginTop:16}}>
                <button onClick={saveWP} style={{...bSt("#00e5a0"),padding:"10px 20px",display:"flex",alignItems:"center",gap:6}}><Ico name="squareCheck" size={13} color="#00e5a0"/>Save Work Profile</button>
                <button onClick={()=>setWpEdit(false)} style={{...bSt("#4a7fa5"),padding:"10px 16px"}}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ── SETTINGS PAGE ─────────────────────────────────────────────
function SettingsPage({ settings, setSetting, t, installPrompt, setInstallPrompt, onClose }) {
  const showPWA = isAndroidMobile() && installPrompt;
  const handleInstall=async()=>{
    if(!installPrompt) return;
    installPrompt.prompt();
    const {outcome}=await installPrompt.userChoice;
    if(outcome==="accepted") setInstallPrompt(null);
  };
  return (
    <div style={{position:"fixed",inset:0,background:t.pageBg,zIndex:9000,overflowY:"auto",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <div style={{padding:"14px 14px 0"}}>
        <div style={{background:t.headerBg,border:`1px solid ${t.headerBorder}`,borderRadius:16,padding:"12px 18px",display:"flex",alignItems:"center",gap:12,backdropFilter:"blur(16px)"}}>
          <button onClick={onClose} style={{background:"transparent",border:`1px solid ${t.cardBorder}`,borderRadius:9,width:36,height:36,cursor:"pointer",color:t.text,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
          <div style={{fontSize:17,fontWeight:800,color:t.text}}>Settings</div>
        </div>
      </div>
      <div style={{maxWidth:600,margin:"20px auto",padding:"0 14px 48px"}}>
        <div style={{background:t.sectionBg,border:`1px solid ${t.sectionBorder}`,borderRadius:20,padding:24,marginBottom:14}}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:16}}>🎨 Appearance</div>
          <div style={{fontSize:11,color:t.subText,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Theme</div>
          <div style={{display:"flex",gap:10}}>
            {[["dark","🌙 Dark","Space dark theme"],["light","☀️ Light","Clean light theme"]].map(([id,label,desc])=>(
              <button key={id} onClick={()=>setSetting("theme",id)} style={{flex:1,padding:"14px 12px",background:settings.theme===id?"rgba(0,229,160,0.15)":"transparent",border:`1px solid ${settings.theme===id?"rgba(0,229,160,0.5)":t.cardBorder}`,borderRadius:14,cursor:"pointer",textAlign:"center"}}>
                <div style={{fontSize:22,marginBottom:6}}>{label.split(" ")[0]}</div>
                <div style={{fontSize:13,fontWeight:700,color:settings.theme===id?"#00e5a0":t.text}}>{label.split(" ").slice(1).join(" ")}</div>
                <div style={{fontSize:11,color:t.subText,marginTop:2}}>{desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{background:t.sectionBg,border:`1px solid ${t.sectionBorder}`,borderRadius:20,padding:24,marginBottom:14}}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:6}}>💱 Default Currency</div>
          <div style={{fontSize:12,color:t.subText,marginBottom:14,lineHeight:1.5}}>All amounts display in your selected currency. Data is stored in BDT internally.</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))",gap:8}}>
            {CURRENCIES.map(c=>(
              <button key={c.code} onClick={()=>setSetting("currency",c.code)} style={{padding:"12px 8px",background:settings.currency===c.code?"rgba(0,229,160,0.15)":"transparent",border:`1px solid ${settings.currency===c.code?"rgba(0,229,160,0.5)":t.cardBorder}`,borderRadius:12,cursor:"pointer",textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:800,color:settings.currency===c.code?"#00e5a0":t.text}}>{c.symbol}</div>
                <div style={{fontSize:11,color:settings.currency===c.code?"#00e5a0":t.subText,marginTop:2}}>{c.code}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{background:t.sectionBg,border:`1px solid ${t.sectionBorder}`,borderRadius:20,padding:24,marginBottom:14}}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>ℹ️ About</div>
          {[["App","Finance Flow"],["Version","2.0"],["Developer","@shakilxvs"],["Support","shakilxvs.wordpress.com"],["Data Storage","Firebase Cloud"]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${t.cardBorder}`,fontSize:13}}>
              <span style={{color:t.subText}}>{k}</span><span style={{color:t.text,fontWeight:600}}>{v}</span>
            </div>
          ))}
        </div>
        {showPWA&&(
          <div style={{background:"linear-gradient(135deg,rgba(0,229,160,0.1),rgba(74,127,165,0.1))",border:"1px solid rgba(0,229,160,0.35)",borderRadius:20,padding:24}}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
              <div style={{width:48,height:48,background:"rgba(0,229,160,0.15)",border:"1px solid rgba(0,229,160,0.3)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Ico name="mobile" size={24} color="#00e5a0"/>
              </div>
              <div>
                <div style={{fontSize:16,fontWeight:800,color:t.text}}>Install Finance Flow</div>
                <div style={{fontSize:12,color:t.subText,marginTop:2}}>Add to your home screen for fast access</div>
              </div>
            </div>
            <div style={{fontSize:12,color:t.subText,marginBottom:16,lineHeight:1.6}}>Works offline · No app store needed · Instant launch · Full-screen experience</div>
            <button onClick={handleInstall} style={{width:"100%",padding:"14px",background:"rgba(0,229,160,0.2)",border:"1px solid rgba(0,229,160,0.5)",borderRadius:14,color:"#00e5a0",cursor:"pointer",fontSize:15,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
              <Ico name="download" size={16} color="#00e5a0"/>Install App — It's Free
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────
function Dashboard({ totalIncome, totalPending, totalExpenses, netBalance, monthIncome, monthExpenses, finance, fname, f, t }) {
  const activePlans=(finance.plans||[]).filter(p=>!p.completed).length;

  const cards=[
    {label:"Total Income",    value:totalIncome,   color:"#00e5a0", icon:"moneyBill"},
    {label:"Pending Payment", value:totalPending,  color:"#f0a500", icon:"hourglass"},
    {label:"Total Expenses",  value:totalExpenses, color:"#ff5c5c", icon:"cardFill"},
    {label:"Net Balance",     value:netBalance,    color:netBalance>=0?"#00e5a0":"#ff5c5c", icon:"creditCard"},
  ];

  const recentTx=[...(finance.income||[]).map(i=>({...i,type:"income"})),...(finance.expenses||[]).map(i=>({...i,type:"expense"})),...(finance.pending||[]).map(i=>({...i,type:"pending"}))].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);

  return (
    <div>
      <div style={{fontSize:24,fontWeight:800,marginBottom:18,marginTop:6,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <span style={{fontSize:26}}>👋</span>
        Hey, {fname}!
        <span style={{fontSize:13,color:t.subText,fontWeight:400,marginLeft:4}}>{new Date().toLocaleString("default",{month:"long",year:"numeric"})}</span>
      </div>

      {/* ── Dynamic flex: cards grow wider when number is long ── */}
      <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:16}}>
        {cards.map(c=>{
          const fmtStr = f(c.value);
          const fs = amtFontSize(fmtStr);
          const flexVal = cardFlex(fmtStr);
          return (
            <div key={c.label} style={{
              background:`${c.color}12`,
              border:`1px solid ${c.color}30`,
              borderRadius:18,
              padding:"18px 16px",
              flex:flexVal,
              minWidth:130,
              boxSizing:"border-box",
              overflow:"hidden",
            }}>
              <Ico name={c.icon} size={20} color={c.color}/>
              <div style={{fontSize:10,color:t.subText,marginTop:10,textTransform:"uppercase",letterSpacing:1,lineHeight:1.4}}>{c.label}</div>
              <div style={{
                fontSize:fs,
                fontWeight:800,
                color:c.color,
                marginTop:4,
                wordBreak:"break-word",
                overflowWrap:"anywhere",
                lineHeight:1.25,
              }}>{fmtStr}</div>
            </div>
          );
        })}
      </div>

      {activePlans>0&&<div style={{background:"rgba(147,112,219,0.08)",border:"1px solid rgba(147,112,219,0.3)",borderRadius:16,padding:"13px 18px",marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
        <Ico name="bullseye" size={24} color="#9370db"/>
        <div><div style={{fontSize:14,fontWeight:700,color:"#9370db"}}>{activePlans} Active Plan{activePlans>1?"s":""}</div><div style={{fontSize:12,color:t.subText}}>Budget plans in progress</div></div>
      </div>}

      <div style={{background:t.sectionBg,border:`1px solid ${t.sectionBorder}`,borderRadius:18,padding:20,marginBottom:12}}>
        <div style={{fontSize:15,fontWeight:700,marginBottom:14,display:"flex",alignItems:"center",gap:8}}><Ico name="chartLine" size={15} color="#00e5a0"/> This Month</div>
        <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
          {[["EARNED",monthIncome,"#00e5a0"],["SPENT",monthExpenses,"#ff5c5c"],["SAVED",monthIncome-monthExpenses,monthIncome-monthExpenses>=0?"#00e5a0":"#ff5c5c"]].map(([l,v,c])=>(
            <div key={l}><div style={{fontSize:11,color:t.subText}}>{l}</div><div style={{fontSize:22,fontWeight:800,color:c}}>{f(v)}</div></div>
          ))}
        </div>
        {monthIncome>0&&<div style={{marginTop:14}}>
          <div style={{background:t.sectionBorder,borderRadius:99,height:8,overflow:"hidden"}}>
            <div style={{width:Math.min(100,(monthExpenses/monthIncome)*100)+"%",background:monthExpenses/monthIncome>0.8?"#ff5c5c":"#00e5a0",height:"100%",borderRadius:99,transition:"width 0.6s"}}/>
          </div>
          <div style={{fontSize:11,color:t.subText,marginTop:5}}>{Math.round((monthExpenses/monthIncome)*100)}% of income spent</div>
        </div>}
      </div>

      <div style={{background:t.sectionBg,border:`1px solid ${t.sectionBorder}`,borderRadius:18,padding:20}}>
        {/* ── FIXED: clock icon for header, creditCard icon for income items ── */}
        <div style={{fontSize:15,fontWeight:700,marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
          <Ico name="clock" size={15} color="#4a7fa5"/> Recent Transactions
        </div>
        {recentTx.length===0&&<div style={{color:t.subText,fontSize:13}}>No transactions yet. Add some!</div>}
        {recentTx.map(tx=>(
          <div key={tx.id+tx.type} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:`1px solid ${t.sectionBorder}`}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <Ico
                name={tx.type==="income"?"creditCard":tx.type==="pending"?"hourglass":"cardFill"}
                size={14}
                color={tx.type==="income"?"#00e5a0":tx.type==="pending"?"#f0a500":"#ff5c5c"}
              />
              <div><div style={{fontSize:13,fontWeight:600,color:t.text}}>{tx.client||tx.category||"—"}</div><div style={{fontSize:11,color:t.subText}}>{tx.date}</div></div>
            </div>
            <div style={{fontWeight:800,fontSize:14,color:tx.type==="income"?"#00e5a0":tx.type==="pending"?"#f0a500":"#ff5c5c"}}>{tx.type==="expense"?"−":"+"}{f(tx.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ── INCOME TAB ────────────────────────────────────────────────
function IncomeTab({ data, onAdd, onUpdate, onDelete, f, t, currency, rates }) {
  const [form,setForm]=useState({client:"",amount:"",date:today(),category:"Project",note:""});
  const [show,setShow]=useState(false);
  const [editId,setEditId]=useState(null);
  const sym=currSym(currency);
  const total=data.reduce((s,i)=>s+Number(i.amount),0);
  const submit=()=>{
    if(!form.client||!form.amount) return;
    onAdd({...form,amount:toBase(form.amount,currency,rates),id:Date.now()});
    setForm({client:"",amount:"",date:today(),category:"Project",note:""});setShow(false);
  };
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <div style={{fontSize:22,fontWeight:800,display:"flex",alignItems:"center",gap:8}}><Ico name="wallet" size={20} color="#00e5a0"/>Income</div>
        <button onClick={()=>setShow(!show)} style={bSt("#00e5a0")}>+ Add Income</button>
      </div>
      <div style={{fontSize:13,color:"#00e5a0",fontWeight:700,marginBottom:18}}>Total Income: {f(total)}</div>
      {show&&<FormCard color="#00e5a0" t={t}>
        <FR label="Client / Source" t={t}><input style={iSt(t)} value={form.client} onChange={e=>setForm(v=>({...v,client:e.target.value}))} placeholder="e.g. Fiverr Client"/></FR>
        <FR label={`Amount (${sym})`} t={t}><input style={iSt(t)} type="number" value={form.amount} onChange={e=>setForm(v=>({...v,amount:e.target.value}))} placeholder="5000"/></FR>
        <FR label="Date" t={t}><input style={iSt(t)} type="date" value={form.date} onChange={e=>setForm(v=>({...v,date:e.target.value}))}/></FR>
        <FR label="Category" t={t}><select style={iSt(t)} value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))}>{INCOME_CATS.map(c=><option key={c}>{c}</option>)}</select></FR>
        <FR label="Note (optional)" t={t}><input style={iSt(t)} value={form.note} onChange={e=>setForm(v=>({...v,note:e.target.value}))} placeholder="e.g. Logo design project"/></FR>
        <div style={{display:"flex",gap:10,marginTop:14}}><button onClick={submit} style={{...bSt("#00e5a0"),display:"flex",alignItems:"center",gap:6}}><Ico name="squareCheck" size={13} color="#00e5a0"/>Save</button><button onClick={()=>setShow(false)} style={bSt("#4a7fa5")}>Cancel</button></div>
      </FormCard>}
      {data.length===0&&!show&&<ES t={t} text="No income yet. Add your first!"/>}
      {data.map(item=>(
        <Card key={item.id} color="#00e5a0" t={t}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:14,color:t.text}}>{item.client}</div><div style={{fontSize:11,color:t.subText,marginTop:2}}>{item.date} · {item.category}{item.note?" · "+item.note:""}</div></div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:10}}>
              <div style={{fontWeight:800,color:"#00e5a0",fontSize:15,whiteSpace:"nowrap"}}>{f(item.amount)}</div>
              <ThreeDotMenu t={t} options={[{icon:<Ico name="pen" size={12} color={t.subText}/>,label:" Edit",action:()=>setEditId(editId===item.id?null:item.id)},{icon:<Ico name="trash" size={12} color="#ff5c5c"/>,label:" Delete",danger:true,action:()=>onDelete(item.id,item.client)}]}/>
            </div>
          </div>
          {editId===item.id&&<InlineEdit t={t} currency={currency} rates={rates} item={item} fields={[{key:"client",label:"Client / Source"},{key:"amount",label:"Amount",isAmount:true},{key:"date",label:"Date",type:"date"},{key:"category",label:"Category",type:"select",options:INCOME_CATS},{key:"note",label:"Note"}]} onSave={v=>{onUpdate(item.id,v);setEditId(null);}} onCancel={()=>setEditId(null)}/>}
        </Card>
      ))}
    </div>
  );
}

// ── PENDING TAB ───────────────────────────────────────────────
function PendingTab({ data, onAdd, onMarkPaid, onUpdate, onDelete, onOpenInvoice, f, t, currency, rates }) {
  const [form,setForm]=useState({client:"",amount:"",date:today(),dueDate:"",note:""});
  const [show,setShow]=useState(false);
  const [editId,setEditId]=useState(null);
  const sym=currSym(currency);
  const total=data.reduce((s,i)=>s+Number(i.amount),0);
  const submit=()=>{
    if(!form.client||!form.amount) return;
    onAdd({...form,amount:toBase(form.amount,currency,rates),id:Date.now()});
    setForm({client:"",amount:"",date:today(),dueDate:"",note:""});setShow(false);
  };
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <div style={{fontSize:22,fontWeight:800,display:"flex",alignItems:"center",gap:8}}><Ico name="hourglass" size={18} color="#f0a500"/>Pending</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={onOpenInvoice} title="Generate Invoice" style={{...bSt("#00e5a0"),padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Ico name="invoice" size={15} color="#00e5a0"/>
          </button>
          <button onClick={()=>setShow(!show)} style={bSt("#f0a500")}>+ Add Pending</button>
        </div>
      </div>
      <div style={{fontSize:13,color:"#f0a500",fontWeight:700,marginBottom:18}}>Total Awaiting: {f(total)}</div>
      {show&&<FormCard color="#f0a500" t={t}>
        <FR label="Client Name" t={t}><input style={iSt(t)} value={form.client} onChange={e=>setForm(v=>({...v,client:e.target.value}))} placeholder="e.g. XYZ Company"/></FR>
        <FR label={`Amount (${sym})`} t={t}><input style={iSt(t)} type="number" value={form.amount} onChange={e=>setForm(v=>({...v,amount:e.target.value}))} placeholder="10000"/></FR>
        <FR label="Invoice Date" t={t}><input style={iSt(t)} type="date" value={form.date} onChange={e=>setForm(v=>({...v,date:e.target.value}))}/></FR>
        <FR label="Due Date" t={t}><input style={iSt(t)} type="date" value={form.dueDate} onChange={e=>setForm(v=>({...v,dueDate:e.target.value}))}/></FR>
        <FR label="Note" t={t}><input style={iSt(t)} value={form.note} onChange={e=>setForm(v=>({...v,note:e.target.value}))} placeholder="e.g. Website project final payment"/></FR>
        <div style={{display:"flex",gap:10,marginTop:14}}><button onClick={submit} style={{...bSt("#f0a500"),display:"flex",alignItems:"center",gap:6}}><Ico name="squareCheck" size={13} color="#f0a500"/>Save</button><button onClick={()=>setShow(false)} style={bSt("#4a7fa5")}>Cancel</button></div>
      </FormCard>}
      {data.length===0&&!show&&<ES t={t} text="No pending payments 🎉 All clear!"/>}
      {data.map(item=>{
        const overdue=item.dueDate&&new Date(item.dueDate)<new Date();
        return (
          <div key={item.id} style={{background:"rgba(240,165,0,0.07)",border:`1px solid ${overdue?"#ff5c5c50":"#f0a50035"}`,borderRadius:14,padding:16,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:15,color:t.text}}>{item.client}</div>
                {item.note&&<div style={{fontSize:12,color:t.subText,marginTop:2}}>{item.note}</div>}
                <div style={{fontSize:11,color:t.subText,marginTop:3}}>Invoice: {item.date}{item.dueDate&&<span style={{color:overdue?"#ff5c5c":t.subText,marginLeft:8}}>{overdue?"⚠️ Overdue: ":"Due: "}{item.dueDate}</span>}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:6}}>
                <div style={{fontWeight:800,color:"#f0a500",fontSize:15,whiteSpace:"nowrap"}}>{f(item.amount)}</div>
                <ThreeDotMenu t={t} options={[{icon:<Ico name="squareCheck" size={12} color={t.subText}/>,label:" Mark Paid",action:()=>onMarkPaid(item.id)},{icon:<Ico name="pen" size={12} color={t.subText}/>,label:" Edit",action:()=>setEditId(editId===item.id?null:item.id)},{icon:<Ico name="trash" size={12} color="#ff5c5c"/>,label:" Delete",danger:true,action:()=>onDelete(item.id,item.client)}]}/>
              </div>
            </div>
            {editId===item.id&&<InlineEdit t={t} currency={currency} rates={rates} item={item} fields={[{key:"client",label:"Client Name"},{key:"amount",label:"Amount",isAmount:true},{key:"date",label:"Invoice Date",type:"date"},{key:"dueDate",label:"Due Date",type:"date"},{key:"note",label:"Note"}]} onSave={v=>{onUpdate(item.id,v);setEditId(null);}} onCancel={()=>setEditId(null)}/>}
          </div>
        );
      })}
    </div>
  );
}

// ── EXPENSES TAB ──────────────────────────────────────────────
function ExpensesTab({ data, onAdd, onUpdate, onDelete, f, t, currency, rates }) {
  const [form,setForm]=useState({category:"Food",amount:"",date:today(),note:""});
  const [show,setShow]=useState(false);
  const [catFilter,setCatFilter]=useState("All");
  const [mFilter,setMFilter]=useState("All");
  const [editId,setEditId]=useState(null);
  const sym=currSym(currency);
  const months=["All",...Array.from(new Set(data.map(i=>i.date?.slice(0,7)).filter(Boolean))).sort().reverse()];
  const filtered=data.filter(i=>(catFilter==="All"||i.category===catFilter)&&(mFilter==="All"||i.date?.startsWith(mFilter)));
  const filtTotal=filtered.reduce((s,i)=>s+Number(i.amount),0);
  const pMonth=m=>m==="All"?"All Months":new Date(m+"-01").toLocaleString("default",{month:"short",year:"numeric"});
  const submit=()=>{
    if(!form.amount) return;
    onAdd({...form,amount:toBase(form.amount,currency,rates),id:Date.now()});
    setForm({category:"Food",amount:"",date:today(),note:""});setShow(false);
  };
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div style={{fontSize:22,fontWeight:800,display:"flex",alignItems:"center",gap:8}}><Ico name="cardFill" size={20} color="#ff5c5c"/>Expenses</div>
        <button onClick={()=>setShow(!show)} style={bSt("#ff5c5c")}>+ Add Expense</button>
      </div>
      {show&&<FormCard color="#ff5c5c" t={t}>
        <FR label="Category" t={t}><select style={iSt(t)} value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))}>{EXPENSE_CATS.map(c=><option key={c}>{c}</option>)}</select></FR>
        <FR label={`Amount (${sym})`} t={t}><input style={iSt(t)} type="number" value={form.amount} onChange={e=>setForm(v=>({...v,amount:e.target.value}))} placeholder="500"/></FR>
        <FR label="Date" t={t}><input style={iSt(t)} type="date" value={form.date} onChange={e=>setForm(v=>({...v,date:e.target.value}))}/></FR>
        <FR label="Note" t={t}><input style={iSt(t)} value={form.note} onChange={e=>setForm(v=>({...v,note:e.target.value}))} placeholder="e.g. Lunch with client"/></FR>
        <div style={{display:"flex",gap:10,marginTop:14}}><button onClick={submit} style={{...bSt("#ff5c5c"),display:"flex",alignItems:"center",gap:6}}><Ico name="squareCheck" size={13} color="#ff5c5c"/>Save</button><button onClick={()=>setShow(false)} style={bSt("#4a7fa5")}>Cancel</button></div>
      </FormCard>}
      <Pills label={<span style={{display:"flex",alignItems:"center",gap:5}}><Ico name="tag" size={10} color={t.subText}/>Month</span>} values={months} active={mFilter} setActive={setMFilter} color="#00e5a0" pretty={pMonth} t={t}/>
      <Pills label={<span style={{display:"flex",alignItems:"center",gap:5}}><Ico name="tag" size={10} color={t.subText}/>Category</span>} values={["All",...EXPENSE_CATS]} active={catFilter} setActive={setCatFilter} color="#ff5c5c" t={t}/>
      {filtered.length>0&&<div style={{fontSize:13,color:"#ff5c5c",marginBottom:12,fontWeight:700}}>Showing {filtered.length} · Total: {f(filtTotal)}</div>}
      {filtered.length===0&&<ES t={t} text="No expenses here. Great job! 🎉"/>}
      {filtered.map(item=>(
        <Card key={item.id} color="#ff5c5c" t={t}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:14,color:t.text}}>{item.category}</div><div style={{fontSize:11,color:t.subText,marginTop:2}}>{item.date}{item.note?" · "+item.note:""}</div></div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:10}}>
              <div style={{fontWeight:800,color:"#ff5c5c",fontSize:15,whiteSpace:"nowrap"}}>{f(item.amount)}</div>
              <ThreeDotMenu t={t} options={[{icon:<Ico name="pen" size={12} color={t.subText}/>,label:" Edit",action:()=>setEditId(editId===item.id?null:item.id)},{icon:<Ico name="trash" size={12} color="#ff5c5c"/>,label:" Delete",danger:true,action:()=>onDelete(item.id,item.category)}]}/>
            </div>
          </div>
          {editId===item.id&&<InlineEdit t={t} currency={currency} rates={rates} item={item} fields={[{key:"category",label:"Category",type:"select",options:EXPENSE_CATS},{key:"amount",label:"Amount",isAmount:true},{key:"date",label:"Date",type:"date"},{key:"note",label:"Note"}]} onSave={v=>{onUpdate(item.id,v);setEditId(null);}} onCancel={()=>setEditId(null)}/>}
        </Card>
      ))}
    </div>
  );
}

// ── PLANS TAB ─────────────────────────────────────────────────
function PlansTab({ data, onAdd, onUpdate, onDelete, onComplete, f, t, currency, rates }) {
  const [form,setForm]=useState({title:"",budget:"",category:"Equipment",dueDate:"",note:""});
  const [show,setShow]=useState(false);
  const [editId,setEditId]=useState(null);
  const [completeId,setCompleteId]=useState(null);
  const [completeDate,setCompleteDate]=useState(today());
  const sym=currSym(currency);
  const active=data.filter(p=>!p.completed);
  const completed=data.filter(p=>p.completed);
  const totalBudget=active.reduce((s,p)=>s+Number(p.budget),0);
  const submit=()=>{
    if(!form.title||!form.budget) return;
    onAdd({...form,budget:toBase(form.budget,currency,rates),id:Date.now(),completed:false});
    setForm({title:"",budget:"",category:"Equipment",dueDate:"",note:""});setShow(false);
  };
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <div style={{fontSize:22,fontWeight:800,display:"flex",alignItems:"center",gap:8}}><Ico name="bullseye" size={20} color="#9370db"/>Plans</div>
        <button onClick={()=>setShow(!show)} style={bSt("#9370db")}>+ Add Plan</button>
      </div>
      <div style={{fontSize:13,color:"#9370db",fontWeight:700,marginBottom:18}}>Total Budget: {f(totalBudget)}</div>
      {show&&<FormCard color="#9370db" t={t}>
        <FR label="Plan Title" t={t}><input style={iSt(t)} value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))} placeholder="e.g. Buy new MacBook"/></FR>
        <FR label={`Budget (${sym})`} t={t}><input style={iSt(t)} type="number" value={form.budget} onChange={e=>setForm(v=>({...v,budget:e.target.value}))} placeholder="1500"/></FR>
        <FR label="Category" t={t}><select style={iSt(t)} value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))}>{PLAN_CATS.map(c=><option key={c}>{c}</option>)}</select></FR>
        <FR label="Target Date" t={t}><input style={iSt(t)} type="date" value={form.dueDate} onChange={e=>setForm(v=>({...v,dueDate:e.target.value}))}/></FR>
        <FR label="Note" t={t}><input style={iSt(t)} value={form.note} onChange={e=>setForm(v=>({...v,note:e.target.value}))} placeholder="e.g. For video editing work"/></FR>
        <div style={{display:"flex",gap:10,marginTop:14}}><button onClick={submit} style={{...bSt("#9370db"),display:"flex",alignItems:"center",gap:6}}><Ico name="squareCheck" size={13} color="#9370db"/>Save</button><button onClick={()=>setShow(false)} style={bSt("#4a7fa5")}>Cancel</button></div>
      </FormCard>}
      {completeId&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:t.popupBg,border:`1px solid ${t.cardBorder}`,borderRadius:20,padding:30,maxWidth:320,width:"100%",textAlign:"center",boxShadow:"0 24px 64px rgba(0,0,0,0.4)"}}>
            <div style={{fontSize:38,marginBottom:12}}>🎉</div>
            <div style={{fontSize:17,fontWeight:800,color:t.text,marginBottom:6}}>Mark as Completed!</div>
            <div style={{fontSize:13,color:t.subText,marginBottom:20}}>This will add the budget as an expense.</div>
            <FR label="Completion Date" t={t}><input type="date" value={completeDate} onChange={e=>setCompleteDate(e.target.value)} style={{...iSt(t),width:"100%"}}/></FR>
            <div style={{display:"flex",gap:10,marginTop:16}}>
              <button onClick={()=>setCompleteId(null)} style={{flex:1,padding:"11px",background:"transparent",border:`1px solid ${t.cardBorder}`,borderRadius:12,color:t.subText,cursor:"pointer",fontSize:13}}>Cancel</button>
              <button onClick={()=>{onComplete(completeId,completeDate);setCompleteId(null);}} style={{flex:1,padding:"11px",background:"rgba(0,229,160,0.15)",border:"1px solid #00e5a060",borderRadius:12,color:"#00e5a0",cursor:"pointer",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Ico name="squareCheck" size={13} color="#00e5a0"/>Confirm</button>
            </div>
          </div>
        </div>
      )}
      {active.length===0&&!show&&<ES t={t} text="No plans yet. Add your first budget plan!"/>}
      {active.map(item=>(
        <div key={item.id} style={{background:"rgba(147,112,219,0.07)",border:"1px solid rgba(147,112,219,0.28)",borderRadius:14,padding:16,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:15,color:t.text}}>{item.title}</div>
              <div style={{fontSize:11,color:t.subText,marginTop:2}}>{item.category}{item.note?" · "+item.note:""}</div>
              {item.dueDate&&<div style={{fontSize:11,color:t.subText,marginTop:2}}>🗓 Target: {item.dueDate}</div>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:6}}>
              <div style={{fontWeight:800,color:"#9370db",fontSize:15,whiteSpace:"nowrap"}}>{f(item.budget)}</div>
              <ThreeDotMenu t={t} options={[{icon:<Ico name="squareCheck" size={12} color={t.subText}/>,label:" Complete",action:()=>{setCompleteId(item.id);setCompleteDate(today());}},{icon:<Ico name="pen" size={12} color={t.subText}/>,label:" Edit",action:()=>setEditId(editId===item.id?null:item.id)},{icon:<Ico name="trash" size={12} color="#ff5c5c"/>,label:" Delete",danger:true,action:()=>onDelete(item.id,item.title)}]}/>
            </div>
          </div>
          {editId===item.id&&<InlineEdit t={t} currency={currency} rates={rates} item={item} fields={[{key:"title",label:"Plan Title"},{key:"budget",label:"Budget",isAmount:true},{key:"category",label:"Category",type:"select",options:PLAN_CATS},{key:"dueDate",label:"Target Date",type:"date"},{key:"note",label:"Note"}]} onSave={v=>{onUpdate(item.id,v);setEditId(null);}} onCancel={()=>setEditId(null)}/>}
        </div>
      ))}
      {completed.length>0&&(
        <div style={{marginTop:28}}>
          <div style={{fontSize:12,color:t.subText,fontWeight:700,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Completed Plans</div>
          {completed.map(item=>(
            <div key={item.id} style={{background:t.cardBg,border:`1px solid ${t.cardBorder}`,borderRadius:12,padding:"12px 16px",marginBottom:8,opacity:0.55}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontWeight:600,fontSize:14,color:t.text,textDecoration:"line-through"}}>{item.title}</div><div style={{fontSize:11,color:t.subText}}>Completed: {item.completionDate}</div></div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#00e5a0"}}>{f(item.budget)}</div>
                  <ThreeDotMenu t={t} options={[{icon:<Ico name="trash" size={12} color="#ff5c5c"/>,label:" Delete",danger:true,action:()=>onDelete(item.id,item.title)}]}/>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SHARED ────────────────────────────────────────────────────
function Card({children,color,t}){return <div style={{background:t.cardBg,border:`1px solid ${t.cardBorder}`,borderLeft:`3px solid ${color}`,borderRadius:14,padding:"13px 16px",marginBottom:9}}>{children}</div>;}
function FormCard({children,color,t}){return <div style={{background:t.sectionBg,border:`1px solid ${color}40`,borderRadius:16,padding:20,marginBottom:20}}>{children}</div>;}
function FR({label,children,t}){return <div style={{marginBottom:12}}><div style={{fontSize:10,color:t.subText,marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>{label}</div>{children}</div>;}
function ES({text,t}){return <div style={{textAlign:"center",padding:"48px 20px",color:t.subText,fontSize:14,border:`1px dashed ${t.cardBorder}`,borderRadius:16}}>{text}</div>;}
function Pills({label,values,active,setActive,color,pretty,t}){
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:10,color:t.subText,marginBottom:6,textTransform:"uppercase",letterSpacing:1,display:"flex",alignItems:"center",gap:4}}>{label}</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {values.map(v=><button key={v} onClick={()=>setActive(v)} style={{background:active===v?`${color}22`:"transparent",border:`1px solid ${active===v?color+"80":t.cardBorder}`,color:active===v?color:t.subText,borderRadius:99,padding:"4px 13px",fontSize:12,cursor:"pointer"}}>{pretty?pretty(v):v}</button>)}
      </div>
    </div>
  );
}
const iSt=t=>({width:"100%",background:t.inputBg,border:`1px solid ${t.inputBorder}`,borderRadius:9,color:t.inputText||t.text,padding:"10px 12px",fontSize:14,boxSizing:"border-box",outline:"none"});
function bSt(color){return {background:`${color}18`,border:`1px solid ${color}60`,color,borderRadius:9,padding:"8px 18px",cursor:"pointer",fontSize:13,fontWeight:700,transition:"all 0.2s"};}
