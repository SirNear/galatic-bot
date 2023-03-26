			function handlePokemonType(type) {
			  switch (type) {
			    case 'fire':
			      return 'fogo';
			      break;
			    case 'water':
			      return 'água';
			      break;
			    case 'grass':
			      return 'grama';
			      break;
			    case 'electric':
			      return 'elétrico';
			      break;
			    case 'rock':
			      return 'pedra';
			      break;
			    case 'ground':
			      return 'terra';
			      break;
			    case 'psychic':
			      return 'psíquico';
			      break;
			    case 'ice':
			      return 'gelo';
			      break;
			    case 'fighting':
			      return 'lutador';
			      break;
			    case 'ghost':
			      return 'fantasma';
			      break;
			    case 'poison':
			      return 'veneno';
			      break;
			    case 'flying':
			      return 'voador';
			      break;
			    case 'bug':
			      return 'inseto';
			      break;
			    case 'dark':
			      return 'sombrio';
			      break;
			    case 'steel':
			      return 'aço';
			      break;
			    case 'dragon':
			      return 'dragão';
			      break;
			    case 'fairy':
			      return 'fada';
			      break;
			    default:
			      return type;
			      break;
			  }
			}

module.exports = { handlePokemonType }
