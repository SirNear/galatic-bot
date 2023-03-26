			function handleTypeIdentifier(type) {
			  switch (type) {
			    case 'fire':
			      return 10;
			      break;
			    case 'water':
			      return 11;
			      break;
			    case 'grass':
			      return 12;
			      break;
			    case 'electric':
			      return 13;
			      break;
			    case 'rock':
			      return 6;
			      break;
			    case 'ground':
			      return 5;
			      break;
			    case 'psychic':
			      return 14;
			      break;
			    case 'ice':
			      return 15;
			      break;
			    case 'fighting':
			      return 2;
			      break;
			    case 'ghost':
			      return 8;
			      break;
			    case 'poison':
			      return 4;
			      break;
			    case 'flying':
			      return 3;
			      break;
			    case 'bug':
			      return 7;
			      break;
			    case 'dark':
			      return 17;
			      break;
			    case 'steel':
			      return 9;
			      break;
			    case 'dragon':
			      return 16;
			      break;
			    case 'fairy':
			      return 18;
			      break;
          case 'normal':
            return 1
			    default:
			      return type;
			      break;
			  }
			}

module.exports = { handleTypeIdentifier }
