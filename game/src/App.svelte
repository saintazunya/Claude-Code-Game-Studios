<script lang="ts">
  import './app.css';
  import { screen } from './engine/store';
  import TitleScreen from './ui/TitleScreen.svelte';
  import CharacterCreation from './ui/CharacterCreation.svelte';
  import MainGame from './ui/MainGame.svelte';
  import EventPopup from './ui/EventPopup.svelte';
  import QuarterSummary from './ui/QuarterSummary.svelte';
  import EndgameScore from './ui/EndgameScore.svelte';

  const currentScreen = $derived($screen);
</script>

{#if currentScreen === 'title'}
  <TitleScreen />
{:else if currentScreen === 'creation'}
  <CharacterCreation />
{:else if currentScreen === 'game'}
  <MainGame />
{:else if currentScreen === 'event'}
  <EventPopup />
{:else if currentScreen === 'summary'}
  <QuarterSummary />
{:else if currentScreen === 'endgame'}
  <EndgameScore />
{/if}
