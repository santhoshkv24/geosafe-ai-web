// Southern India mine locations
const MINE_LOCATIONS = [
  {
    name: "Hutti Gold Mine",
    state: "Karnataka",
    location: { lat: 15.4167, lng: 76.4000 },
    zone: "HUTTI_ZONE",
    description: "One of India's major gold mining operations"
  },
  {
    name: "Kolar Gold Fields",
    state: "Karnataka", 
    location: { lat: 12.9516, lng: 78.1309 },
    zone: "KGF_ZONE",
    description: "Historic gold mining region"
  },
  {
    name: "Sandur Iron Ore Mine",
    state: "Karnataka",
    location: { lat: 15.1167, lng: 76.5500 },
    zone: "SANDUR_ZONE", 
    description: "Major iron ore extraction site"
  },
  {
    name: "Hospet Mining Area",
    state: "Karnataka",
    location: { lat: 15.2686, lng: 76.3900 },
    zone: "HOSPET_ZONE",
    description: "Iron ore and manganese mining"
  },
  {
    name: "Kudremukh Iron Ore",
    state: "Karnataka",
    location: { lat: 13.2833, lng: 75.1000 },
    zone: "KUDREMUKH_ZONE",
    description: "Iron ore mining in Western Ghats"
  },
  {
    name: "Neyveli Lignite Mine",
    state: "Tamil Nadu",
    location: { lat: 11.6173, lng: 79.4900 },
    zone: "NEYVELI_ZONE", 
    description: "Major lignite coal mining operation"
  },
  {
    name: "Salem Magnesite Mine",
    state: "Tamil Nadu",
    location: { lat: 11.6643, lng: 78.1460 },
    zone: "SALEM_ZONE",
    description: "Magnesite and limestone extraction"
  },
  {
    name: "Singareni Collieries",
    state: "Telangana",
    location: { lat: 17.9784, lng: 79.5941 },
    zone: "SINGARENI_ZONE",
    description: "Coal mining operations"
  },
  {
    name: "Bailadila Iron Ore",
    state: "Chhattisgarh",
    location: { lat: 18.6167, lng: 81.3000 },
    zone: "BAILADILA_ZONE",
    description: "High-grade iron ore deposits"
  },
  {
    name: "Korba Coalfields",
    state: "Chhattisgarh", 
    location: { lat: 22.3595, lng: 82.7501 },
    zone: "KORBA_ZONE",
    description: "Major coal mining region"
  }
];

module.exports = { MINE_LOCATIONS };