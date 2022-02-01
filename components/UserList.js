import React from 'react';
import { StyleSheet, View, FlatList } from 'react-native';
import { Text } from 'react-native-elements';
import Colors from '../assets/Colors';
import ThemeColors from '../assets/ThemeColors';

const UserList = (props) => {
  let colors = props.colors || [...Colors];

  const renderUser = (user, index) => {
    // let backgroundColor = props.colors ? props.colors[user.username] : colors?.splice(Math.floor(Math.random() * colors.length), 1)[0];
    let backgroundColor = ThemeColors.card;
    let opacity = 1;
    let borderColor = props.colors ? props.colors[user.username] : colors?.splice(Math.floor(Math.random() * colors.length), 1)[0];
    let borderWidth = 2;
    let userTextColor = '#fff';

    if (props.bet?.status === 'voting') {
      backgroundColor = user.votedOption !== undefined ? backgroundColor : 'grey';
      opacity = user.votedOption !== undefined ? 1 : 0.3;
    } else if (props.bet?.status === 'complete') {
      // borderColor = user.selectedOption === props.bet.winningOption ? '#2ac73b' : 'red';
      userTextColor = user.selectedOption === props.bet.winningOption ? '#2ac73b' : 'red';
      borderWidth = 2;
    }

    return (
      <View onStartShouldSetResponder={() => true} style={[styles.userPill, { backgroundColor, opacity, borderColor, borderWidth, marginVertical: props.onOption ? 0 : 10 }]}>
        <Text style={[styles.userText, { color: userTextColor, fontSize: props.onCard ? 12 : 20 }]}>{user.username}</Text>
      </View>
    );
  };
  
  return (
    <View style={styles.list} >
      <FlatList
        horizontal
        data={props.users}
        renderItem={({ item, index }) => renderUser(item, index)}
        keyExtractor={(user) => user.username}
      />
    </View>
  );
};

export default UserList;

const styles = StyleSheet.create({
  userPill: {
    paddingBottom: 2,
    paddingHorizontal: 10,
    borderRadius: 15,
    marginHorizontal: 5
  },
  userText: {
    // color: '#fff',
    fontWeight: 'bold',
  },
  list: {
    paddingBottom: 0,
    flex: 1,
  },
});