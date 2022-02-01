import React from 'react';
import { StyleSheet, View, SafeAreaView, FlatList } from 'react-native';
import { Input, Button, Overlay, Text } from 'react-native-elements';
import LoadingSpinner from './LoadingSpinner';
import * as firebase from 'firebase';
import { ReadUserFromFile, WriteUserToFile, RemoveBetsFromUserFile } from '../Util';
import Bet from './Bet';
import { UserColors } from '../ColorContext';

export default class BetFeed extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      bets: [],
      loading: false,
      user: '',
    };
  }

  async componentDidMount() {
    this.loadBets();
    this.props.navigation.addListener('focus', () => {
      // Screen was focused
      this.reloadBets();
    });
  }

  /**
   * Loads any new bets that were added to the userdata file that aren't already in state
   */
  async reloadBets() {
    let oldBets = this.state.bets;
    const user = await ReadUserFromFile();
    let newBetIds = user.bets;
    this.setState({ user });
    let betBuilder = [];
    let betsToFetch = [];
    oldBets.forEach((bet) => {
      if (newBetIds.includes(bet.id)) {
        betBuilder.push(bet);
      }
    });
    newBetIds.forEach((betId) => {
      if (!betBuilder.find((bet) => { bet.id === betId })) {
        betsToFetch.push(betId);
      }
    });
    betBuilder.concat(await this.fetchBets(betsToFetch));
  }

  /**
   * Finds bets by the given betIds
   * @param {array} betIds of the bets to query from db
   * @returns array of bet objects matching the @param betIds 
   */
  async fetchBets(betIds) {
    let betBuilder = [];
    let betRef = firebase.database().ref("Bet");
    let promises = betIds.map(async (betId) => {
      return betRef.child(betId).once('value').catch(() => {
        console.log("invlaid bet:" + betId);
      });
    });
    Promise.all(promises).then(async(snapshots) => {
      snapshots.forEach(async(snapshot) => {
        if (snapshot.val().status === 'closed') {
          // remove bet from userfile
          RemoveBetsFromUserFile([snapshot.key]);
        } else {
          betBuilder.push({ "id": snapshot.key, ...snapshot.val() });
        }
      });
      this.setState({ bets: betBuilder ? this.sortBets(betBuilder.reverse()) : null });
      return betBuilder;
    });
  }

  async loadBets() {
    this.setState({ loading: true });
    const user = await ReadUserFromFile();
    let betIds = user.bets;
    this.setState({ user });
    await this.fetchBets(betIds);
    this.setState({ loading: false });
  }

  sortBets(bets) {
    let incompleteBets = [];
    let completeBets = bets.filter((bet) => {
      if (bet.status === 'complete') {
        return true;
      }
      incompleteBets.push(bet);
    });
    return incompleteBets.concat(completeBets);
  }

  renderBetCard = (bet) => {
    return (
      <Bet bet={bet} colors={this.context.userColors} user={this.state.user} navigation={this.props.navigation}/>
    );
  };

  render() {
    const { bets, loading } = this.state;
    const padding = <View style={{ paddingBottom: 10 }} />;
    const emptyList = (
      <View style={styles.emptyList}>
        <Text>There are no vows.</Text>
      </View>
    );
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner spinning={loading} />
        <View style={styles.list}>
          <FlatList
            ListHeaderComponent={padding}
            ListFooterComponent={padding}
            ListEmptyComponent={emptyList}
            stickyHeaderIndices={[0]}
            data={bets}
            renderItem={({ item }) => this.renderBetCard(item)}
            keyExtractor={(bet) => bet.id}
          />
        </View>
      </SafeAreaView>
    );
  }
}

BetFeed.contextType = UserColors;

const styles = StyleSheet.create({
  container: {
  },
  list: {
    paddingBottom: 0,
    height: '100%',
  },
  emptyList: {
    alignSelf: 'center',
    paddingTop: '45%',
  },
});
